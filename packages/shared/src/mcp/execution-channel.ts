import type { PolicyDecision } from "../policy/decision.js";
import type { SchemaFingerprint, ToolIdentity } from "../registry/identity.js";
import type { ExecutionOutcome } from "../execution/result.js";
import type { SessionId } from "../session/session-id.js";
import type { OperationId } from "../audit/operation-id.js";

/**
 * Domain contract for the MCP-server <-> Execution IPC channel (DEC-047). Deliberately NOT
 * `SecretsBrokerTransport` (DEC-010) — a distinct interface for a distinct pair of processes and
 * a distinct message shape, reusing only the transport *pattern* (agnostic interface + OS-level
 * ACL'd named pipe/Unix socket), never the Secrets Broker's own typed contract.
 */
export interface ExecutionChannelRequest {
  readonly identity: ToolIdentity;
  readonly hostId: string;
  readonly parameters: Readonly<Record<string, string>>;
  readonly decision: PolicyDecision;
  /**
   * Correlation metadata only (DEC-049, DEC-054, DEC-056) — Execution never uses these for
   * authorization or confirmation logic (Policy Engine's approval store and the operation-hash
   * registry remain untouched). `sessionId` groups all operations of one MCP server process
   * lifetime; `operationId` uniquely identifies THIS invocation — distinct from `OperationHash`
   * (DEC-038), which is deterministic over the tuple below and can repeat across invocations with
   * identical arguments. Carried through so a future Audit Log (Fase 10) can correlate events
   * Execution writes with the ones the MCP server writes for the same invocation.
   */
  readonly sessionId: SessionId;
  readonly operationId: OperationId;
}

export type ExecutionChannelResponse =
  | { readonly ok: true; readonly outcome: ExecutionOutcome }
  | { readonly ok: false; readonly reason: string };

/** Client-side view of the channel, used by the MCP server (DEC-047). */
export interface ExecutionChannelClient {
  connect(): Promise<void>;
  request(req: ExecutionChannelRequest): Promise<ExecutionChannelResponse>;
  /**
   * Propagates a cancellation for an in-flight request to the Execution process (DEC-045).
   * `operationId` (DEC-054/056) is carried purely so Execution can label its own
   * `confirmation-resolved`/audit events for the same invocation — it plays no role in
   * `cancelOperation()`'s hash computation, which remains exactly the tuple below (identity,
   * hostId, parameters, schemaFingerprint), unchanged.
   */
  cancel(
    identity: ToolIdentity,
    hostId: string,
    parameters: Readonly<Record<string, string>>,
    schemaFingerprint: SchemaFingerprint,
    sessionId: SessionId,
    operationId: OperationId,
  ): Promise<void>;
  close(): Promise<void>;
}
