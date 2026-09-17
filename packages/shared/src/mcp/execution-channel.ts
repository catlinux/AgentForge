import type { PolicyDecision } from "../policy/decision.js";
import type { SchemaFingerprint, ToolIdentity } from "../registry/identity.js";
import type { ExecutionOutcome } from "../execution/result.js";
import type { SessionId } from "../session/session-id.js";

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
   * Correlation metadata only (DEC-049) — Execution never uses this for authorization or
   * confirmation logic (Policy Engine's approval store and the operation-hash registry remain
   * untouched by Sessions). Carried through purely so a future Audit Log (Fase 10) can group
   * related events.
   */
  readonly sessionId: SessionId;
}

export type ExecutionChannelResponse =
  | { readonly ok: true; readonly outcome: ExecutionOutcome }
  | { readonly ok: false; readonly reason: string };

/** Client-side view of the channel, used by the MCP server (DEC-047). */
export interface ExecutionChannelClient {
  connect(): Promise<void>;
  request(req: ExecutionChannelRequest): Promise<ExecutionChannelResponse>;
  /** Propagates a cancellation for an in-flight request to the Execution process (DEC-045). */
  cancel(
    identity: ToolIdentity,
    hostId: string,
    parameters: Readonly<Record<string, string>>,
    schemaFingerprint: SchemaFingerprint,
  ): Promise<void>;
  close(): Promise<void>;
}
