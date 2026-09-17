import { createServer, type Server, type Socket } from "node:net";
import type {
  AuditWriter,
  ExecutionChannelRequest,
  ExecutionChannelResponse,
  OperationId,
  SessionId,
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
 * Server side of the MCP-server <-> Execution IPC channel (DEC-047). Listens on the fixed
 * channel path (DEC-047 — single instance, no discovery in this phase). Every message is either
 * an execution request (routed through `execute()`, never bypassing Policy Engine's decision) or
 * a cancellation (routed to `cancelOperation`, propagating DEC-045's cancellation guarantee into
 * this process). Any malformed message or internal error responds with `ok: false` — the caller
 * (the MCP server) must treat that identically to a missing confirmation: fail closed, never
 * proceed.
 *
 * `auditWriter` (DEC-052/054/057) is optional infrastructure for the audit events this process is
 * responsible for (confirmation-resolved, execution-completed) — its absence or any write failure
 * never affects the fail-closed behavior above (DEC-057, best effort).
 */
export function startExecutionServer(
  deps: ExecuteDependencies & { readonly confirmationRegistry: OperationHashRegistry },
  socketPath: string,
  auditWriter?: AuditWriter,
): Server {
  // One tracker per server instance (Fase 10) — not per message, same lifetime as
  // `deps.confirmationRegistry`. Built here when the caller does not already provide one via
  // `deps.pendingConfirmations`, so existing callers/tests need no changes.
  const pendingConfirmations = deps.pendingConfirmations ?? new PendingConfirmations();
  const server = createServer((socket: Socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      let newlineIndex: number;
      // Newline-delimited JSON framing, same style as MCP's own stdio framing (DEC-046) — kept
      // simple and consistent across the project's IPC channels.
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.trim().length === 0) continue;
        void handleLine(line, socket, deps, pendingConfirmations, auditWriter);
      }
    });
    socket.on("error", () => {
      // Never let a socket-level error crash the server process; the client sees the connection
      // drop, which it must treat as fail-closed per DEC-047.
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
    // Determine, before mutating the registry, whether a confirmation was actually pending for
    // this exact operation tuple. `OperationHashRegistry` itself cannot answer this — it only
    // knows terminal states ("used"/"cancelled"), never "in flight, awaiting the operator" — so a
    // cancellation arriving while a confirmation is genuinely pending would otherwise look
    // identical, at the registry level, to one arriving for an operation that never required
    // confirmation at all. `pendingConfirmations` (Fase 10) is a separate, minimal tracker built
    // exactly for this: it never participates in the authorization decision, only in whether this
    // audit event is accurate.
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
    // Cancellation acknowledgement carries no outcome — it is fire-and-forget from the client's
    // perspective, consistent with DEC-045: the client does not need a response to know it must
    // treat the operation as cancelled on its own side too.
    //
    // Only emit `confirmation-resolved` when a confirmation was genuinely pending (DEC-054/055:
    // audit events must reflect only what is actually true). A "cancel" message can arrive for an
    // operation that never required confirmation at all (e.g. verdict "allow", cancelled before
    // Execution even received the "execute" message) — in that case nothing here was ever
    // resolved, and `tools-call.ts` already recorded the cancellation from the MCP server's own
    // side via `operation-cancelled { phase: "before-execution" }`.
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
        exitCode: outcome.kind === "executed" ? outcome.exitCode : undefined,
        reason:
          "reason" in outcome
            ? outcome.reason
            : outcome.kind === "timed-out"
              ? "SSH timeout"
              : undefined,
        outputTruncated:
          outcome.kind === "executed"
            ? outcome.stdoutTruncated || outcome.stderrTruncated
            : undefined,
        stdoutBytes: outcome.kind === "executed" ? outcome.stdoutBytes : undefined,
        stderrBytes: outcome.kind === "executed" ? outcome.stderrBytes : undefined,
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
      });
    }
    return;
  }
}

function writeResponse(socket: Socket, response: ExecutionChannelResponse): void {
  try {
    socket.write(`${JSON.stringify(response)}\n`);
  } catch {
    // Socket may already be closed (client disconnected mid-operation) — nothing to recover,
    // the client already treats a lost connection as fail-closed.
  }
}
