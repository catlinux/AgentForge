import { createServer, type Server, type Socket } from "node:net";
import type {
  AuditWriter,
  ExecutionChannelRequest,
  ExecutionChannelResponse,
  OperationId,
  SecretId,
  SessionId,
} from "@agentforge/shared";
import {
  AuditWriter as AuditWriterImpl,
  resolveAuditLogPath,
  NetExecutionSecretsChannelClient,
  makeChannelBackedSecretResolver,
  executionSecretsChannelPath,
} from "@agentforge/shared";
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
  deps: Omit<ExecuteDependencies, "getTokenSecret"> & {
    readonly confirmationRegistry: OperationHashRegistry;
    /** Optional (Fase 13, DEC-F): when omitted, defaults to a real Secrets Broker channel client
     * instead of requiring every caller to supply one — see `resolvedGetTokenSecret` below. */
    readonly getTokenSecret?: ExecuteDependencies["getTokenSecret"];
  },
  socketPath: string,
  auditWriter?: AuditWriter,
): Server {
  const pendingConfirmations = deps.pendingConfirmations ?? new PendingConfirmations();
  // DEC-065: default to a real writer for this process's own Audit Log file when the caller does
  // not inject one, instead of silently writing no audit events at all.
  const resolvedAuditWriter =
    auditWriter ?? new AuditWriterImpl(resolveAuditLogPath("connector-github"));
  // Fase 13 (DEC-F): default to a real Secrets Broker channel client when the caller does not
  // inject `getTokenSecret` explicitly. Unlike `execution-ssh`'s `getSshKeySecret(hostId)`, the
  // caller here already passes the `SecretId` itself (`account.tokenSecretId`, resolved by
  // execute.ts before this is ever called) — no host/account lookup needed, just the identity
  // resolver. Connects lazily on first use, same as execution-ssh.
  const resolvedGetTokenSecret =
    deps.getTokenSecret ??
    (() => {
      const channel = new NetExecutionSecretsChannelClient(executionSecretsChannelPath());
      let connected: Promise<void> | undefined;
      const resolver = makeChannelBackedSecretResolver(channel, (id) => id as SecretId);
      return async (secretId: string) => {
        connected ??= channel.connect();
        try {
          await connected;
        } catch {
          return undefined;
        }
        return resolver(secretId);
      };
    })();
  const server = createServer((socket: Socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.trim().length === 0) continue;
        void handleLine(
          line,
          socket,
          { ...deps, getTokenSecret: resolvedGetTokenSecret },
          pendingConfirmations,
          resolvedAuditWriter,
        );
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

  // Fase 13 (hardening): a syntactically valid JSON message with an unexpected shape (e.g.
  // `{"kind":"execute"}` with no `request`, or `request: null`) must never crash this process —
  // this whole body runs from `void handleLine(...)` (fire-and-forget, no caller try/catch), so
  // any unguarded throw here becomes an unhandled promise rejection that terminates the process
  // in modern Node.js. Every branch below already assumed a well-formed `IncomingMessage`; this
  // wrapper is the actual fail-closed guarantee the docstring above promises, not just the
  // JSON.parse guard. Same fix as execution-ssh's execution-server.ts.
  try {
    await handleMessage(message, socket, deps, pendingConfirmations, auditWriter);
  } catch {
    writeResponse(socket, { ok: false, reason: "Malformed request" });
  }
}

async function handleMessage(
  message: IncomingMessage,
  socket: Socket,
  deps: ExecuteDependencies & { readonly confirmationRegistry: OperationHashRegistry },
  pendingConfirmations: PendingConfirmations,
  auditWriter: AuditWriter | undefined,
): Promise<void> {
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
