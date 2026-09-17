import { randomUUID } from "node:crypto";

/**
 * Unique identifier of a single `tools/call` invocation (DEC-054), generated once by the MCP
 * server per invocation, regardless of how it ends (allow/deny/requires-confirmation/cancelled/
 * timed-out/failed).
 *
 * Deliberately distinct from two other identifiers already in the project, never derived from
 * either:
 * - `SessionId` (Fase 9) groups ALL operations of one MCP server process lifetime — it outlives
 *   a single invocation.
 * - `OperationHash` (DEC-038) is deterministic over (identity, parameters, hostId,
 *   schemaFingerprint) and exists only for operations that go through confirmation; it can repeat
 *   across distinct invocations sharing the exact same arguments, by design (its purpose is
 *   single-use confirmation binding, not per-invocation audit identity).
 *
 * `operationId` never participates in Policy Engine evaluation, `OperationHashRegistry` state, or
 * execution logic (DEC-056) — it is correlation metadata only.
 */
export type OperationId = string & { readonly __brand: "OperationId" };

export function generateOperationId(): OperationId {
  return randomUUID() as OperationId;
}
