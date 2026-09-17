import type { ToolIdentity } from "../registry/identity.js";
import type { SessionId } from "../session/session-id.js";
import type { OperationId } from "../audit/operation-id.js";

/** A resolved execution request (Fase 7). Parameters are already validated against the tool's
 * `inputSchema` (DEC-013) before reaching Execution — Execution never receives free-form text.
 *
 * `sessionId`/`operationId` (DEC-056) are correlation metadata only — Execution never uses them
 * for authorization, confirmation, or execution logic (Policy Engine's approval store, the
 * operation-hash registry, and command resolution remain untouched). */
export interface ExecutionRequest {
  readonly identity: ToolIdentity;
  readonly hostId: string;
  readonly parameters: Readonly<Record<string, string>>;
  readonly sessionId: SessionId;
  readonly operationId: OperationId;
}
