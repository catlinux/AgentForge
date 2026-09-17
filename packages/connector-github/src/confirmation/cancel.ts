import type { SchemaFingerprint, ToolIdentity } from "@agentforge/shared";
import { computeOperationHash } from "./operation-hash.js";
import type { OperationHashRegistry } from "./hash-registry.js";

/**
 * Propagates an external cancellation (DEC-045) down to the confirmation registry — same
 * construction as `execution-ssh/src/confirmation/cancel.ts`.
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
