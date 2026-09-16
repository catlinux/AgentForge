import type { SchemaFingerprint, ToolIdentity } from "@agentforge/shared";
import type { ConfirmationChannel } from "./confirmation-channel.js";
import { computeOperationHash, type OperationHash } from "./operation-hash.js";

export interface ConfirmationRequest {
  readonly identity: ToolIdentity;
  readonly parameters: Readonly<Record<string, string>>;
  readonly hostId: string;
  readonly hostname: string;
  readonly schemaFingerprint: SchemaFingerprint;
  readonly resolvedCommand: readonly string[];
}

export type ConfirmationOutcome =
  | { readonly confirmed: true }
  | { readonly confirmed: false; readonly reason: "rejected" | "timed-out" | "already-used" };

/**
 * Enforces DEC-038's security guarantees, independent of the interaction mechanism:
 * - binds the confirmation to a deterministic hash of the full operation tuple (guarantee 1);
 * - single use: the returned hash must be marked consumed by the caller via `usedHashes` before
 *   this operation is allowed to proceed, so it can never be replayed for a different invocation
 *   (guarantee 2) — this store is caller-provided and MUST NOT persist across process restarts,
 *   consistent with confirmations never surviving beyond the single execution attempt;
 * - deny-by-default on any ambiguity: rejection, timeout, or a hash already marked used all
 *   resolve to `confirmed: false`, never to a silent pass-through (guarantee 5).
 */
export async function confirmOperation(
  request: ConfirmationRequest,
  channel: ConfirmationChannel,
  usedHashes: Set<OperationHash>,
  timeoutMs: number,
): Promise<ConfirmationOutcome> {
  const operationHash = computeOperationHash(
    request.identity,
    request.parameters,
    request.hostId,
    request.schemaFingerprint,
  );

  if (usedHashes.has(operationHash)) {
    return { confirmed: false, reason: "already-used" };
  }

  const response = await channel.requestConfirmation(
    {
      operationHash,
      resolvedCommand: request.resolvedCommand,
      hostname: request.hostname,
    },
    timeoutMs,
  );

  if (response.kind === "approved") {
    usedHashes.add(operationHash);
    return { confirmed: true };
  }
  if (response.kind === "timed-out") {
    return { confirmed: false, reason: "timed-out" };
  }
  return { confirmed: false, reason: "rejected" };
}
