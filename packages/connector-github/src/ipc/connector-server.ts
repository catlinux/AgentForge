import { createServer, type Server, type Socket } from "node:net";
import type {
  AuditWriter,
  ExecutionChannelRequest,
  ExecutionChannelResponse,
  OperationId,
  SessionId,
} from "@agentforge/shared";
import { AuditWriter as AuditWriterImpl, resolveAuditLogPath } from "@agentforge/shared";
import { execute, type ExecuteDependencies } from "../execute.js";
import { cancelOperation } from "../confirmation/cancel.js";
import { computeOperationHash } from "../confirmation/operation-hash.js";
import type { OperationHashRegistry } from "../confirmation/hash-registry.js";
import { PendingConfirmations } from "../confirmation/pending-confirmations.js";

type IncomingMessage =
  | { readonly kind: "execute"; readonly request: ExecutionChannelRequest }
  | {
      readonly kind: "cancel";
      readonly identity: ExecutionChannelRequest["identity"];
      readonly hostId: string;
      readonly parameters: Readonly<Record<string, string>>;
      readonly schemaFingerprint: ExecutionChannelRequest["decision"]["schemaFingerprint"];
      readonly sessionId: SessionId;
      readonly operationId: OperationId;
    };

/**
 * Server side of the MCP-server <-> connector IPC channel (DEC-047 pattern, DEC-058: this
 * connector is its own Execution Backend process, structurally identical to
 * `execution-ssh/src/ipc/execution-server.ts`). Every message is either an execution request
 * (routed through `execute()`, never bypassing Policy Engine's decision) or a cancellation
 * (routed to `cancelOperation`, propagating DEC-045's cancellation guarantee into this process).
 * Any malformed message or internal error responds with `ok: false` — fail closed, same as SSH.
 */
export function startConnectorServer(
  deps: ExecuteDependencies & { readonly confirmationRegistry: OperationHashRegistry },
  socketPath: string,
  auditWriter?: AuditWriter,
): Server {
  const pendingConfirmations = deps.pendingConfirmations ?? new PendingConfirmations();
  // DEC-065: default to a real writer for this process's own Audit Log file when the caller does
  // not inject one, instead of silently writing no audit events at all.
  const resolvedAuditWriter =
    auditWriter ?? new AuditWriterImpl(resolveAuditLogPath("connector-github"));
  const server = createServer((socket: Socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.trim().length === 0) continue;
        void handleLine(line, socket, deps, pendingConfirmations, resolvedAuditWriter);
      }
    });
    socket.on("error", () => {
      // Never let a socket-level error crash the server process — same fail-closed rule as
      // execution-ssh (DEC-047).
    });
  });
  server.listen(socketPath);
  return server;
}

async function handleLine(
  line: string,
  socket: Socket,
  deps: ExecuteDependencies & { readonly confirmationRegistry: OperationHashRegistry },
  pendingConfirmations: PendingConfirmations,
  auditWriter: AuditWriter | undefined,
): Promise<void> {
  let message: IncomingMessage;
  try {
    message = JSON.parse(line) as IncomingMessage;
  } catch {
    writeResponse(socket, { ok: false, reason: "Malformed request" });
    return;
  }

  if (message.kind === "cancel") {
    const hadPendingConfirmation = pendingConfirmations.has(
      computeOperationHash(
        message.identity,
        message.parameters,
        message.hostId,
        message.schemaFingerprint,
      ),
    );

    cancelOperation(
      deps.confirmationRegistry,
      message.identity,
      message.parameters,
      message.hostId,
      message.schemaFingerprint,
    );
    if (hadPendingConfirmation) {
      void auditWriter?.write({
        type: "confirmation-resolved",
        operationId: message.operationId,
        sessionId: message.sessionId,
        identity: message.identity,
        reason: "cancelled",
      });
    }
    return;
  }

  if (message.kind === "execute") {
    const { sessionId, operationId } = message.request;
    try {
      const outcome = await execute(
        {
          identity: message.request.identity,
          hostId: message.request.hostId,
          parameters: message.request.parameters,
          sessionId,
          operationId,
        },
        message.request.decision,
        { ...deps, pendingConfirmations, ...(auditWriter !== undefined ? { auditWriter } : {}) },
      );
      const response: ExecutionChannelResponse = { ok: true, outcome };
      writeResponse(socket, response);
      void auditWriter?.write({
        type: "execution-completed",
        operationId,
        sessionId,
        identity: message.request.identity,
        outcomeKind: outcome.kind,
        exitCode: undefined,
        reason: "reason" in outcome ? outcome.reason : undefined,
        outputTruncated: undefined,
        stdoutBytes: undefined,
        stderrBytes: undefined,
        statusCode: outcome.kind === "executed-http" ? outcome.statusCode : undefined,
        responseBytes: outcome.kind === "executed-http" ? outcome.responseBytes : undefined,
      });
    } catch {
      writeResponse(socket, { ok: false, reason: "Execution failed unexpectedly" });
      void auditWriter?.write({
        type: "execution-completed",
        operationId,
        sessionId,
        identity: message.request.identity,
        outcomeKind: "failed",
        exitCode: undefined,
        reason: "unexpected-error",
        outputTruncated: undefined,
        stdoutBytes: undefined,
        stderrBytes: undefined,
        statusCode: undefined,
        responseBytes: undefined,
      });
    }
    return;
  }
}

function writeResponse(socket: Socket, response: ExecutionChannelResponse): void {
  try {
    socket.write(`${JSON.stringify(response)}\n`);
  } catch {
    // Socket may already be closed — nothing to recover, same as execution-ssh.
  }
}
