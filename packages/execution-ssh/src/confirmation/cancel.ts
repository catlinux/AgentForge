import type { SchemaFingerprint, ToolIdentity } from "@agentforge/shared";
import { computeOperationHash } from "./operation-hash.js";
import type { OperationHashRegistry } from "./hash-registry.js";

/**
 * Propagates an external cancellation (DEC-045 — originating from the MCP server's handling of
 * `notifications/cancelled`) down to the confirmation registry. Computes the same deterministic
 * hash `confirmOperation` would, so cancelling here reaches the exact operation identified by
 * (identity, parameters, hostId, schemaFingerprint) — never a different one.
 *
 * Returns `true` if the cancellation was recorded before any approval (the operation, if still
 * awaiting confirmation, will now resolve to `confirmed: false, reason: "cancelled"`), or `false`
 * if the hash was already marked "used" — per DEC-045 guarantee 5, a cancellation arriving after
 * the confirmation was already approved does not retroactively invalidate an execution already
 * underway.
 */
export function cancelOperation(
  registry: OperationHashRegistry,
  identity: ToolIdentity,
  parameters: Readonly<Record<string, string>>,
  hostId: string,
  schemaFingerprint: SchemaFingerprint,
): boolean {
  const hash = computeOperationHash(identity, parameters, hostId, schemaFingerprint);
  return registry.markCancelledIfNotUsed(hash);
}
