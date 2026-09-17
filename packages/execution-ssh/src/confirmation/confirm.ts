import type { SchemaFingerprint, ToolIdentity } from "@agentforge/shared";
import type { ConfirmationChannel } from "./confirmation-channel.js";
import { computeOperationHash, type OperationHash } from "./operation-hash.js";
import type { OperationHashRegistry } from "./hash-registry.js";

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
  | {
      readonly confirmed: false;
      readonly reason: "rejected" | "timed-out" | "already-used" | "cancelled";
    };

/**
 * Enforces DEC-038's security guarantees, extended by DEC-045 for MCP `tools/call` cancellation,
 * independent of the interaction mechanism:
 * - binds the confirmation to a deterministic hash of the full operation tuple (guarantee 1);
 * - single use: a hash already marked "used" in `registry` refuses a second attempt (guarantee 2);
 * - deny-by-default on any ambiguity: rejection, timeout, an already-used hash, or a cancelled
 *   hash all resolve to `confirmed: false`, never to a silent pass-through (guarantee 5);
 * - DEC-045: if the caller's request has already been cancelled (via `registry.markCancelledIfNotUsed`
 *   from a `notifications/cancelled` handler) by the time the operator responds, the approval is
 *   discarded here — the check against `registry` and the transition to "used" happen in the same
 *   synchronous tick (no `await` between them), so the race is resolved deterministically by
 *   whichever mutation reaches the registry first, never by wall-clock arrival order.
 */
export async function confirmOperation(
  request: ConfirmationRequest,
  channel: ConfirmationChannel,
  registry: OperationHashRegistry,
  timeoutMs: number,
): Promise<{ outcome: ConfirmationOutcome; operationHash: OperationHash }> {
  const operationHash = computeOperationHash(
    request.identity,
    request.parameters,
    request.hostId,
    request.schemaFingerprint,
  );

  const existing = registry.get(operationHash);
  if (existing === "used") {
    return { outcome: { confirmed: false, reason: "already-used" }, operationHash };
  }
  if (existing === "cancelled") {
    return { outcome: { confirmed: false, reason: "cancelled" }, operationHash };
  }

  const response = await channel.requestConfirmation(
    {
      operationHash,
      resolvedCommand: request.resolvedCommand,
      hostname: request.hostname,
    },
    timeoutMs,
  );

  // Everything from here to the registry mutation is synchronous — no `await` in between, so
  // the cancellation race (DEC-045 guarantee 4) is resolved deterministically.
  if (response.kind === "approved") {
    const marked = registry.markUsedIfNotCancelled(operationHash);
    if (!marked) {
      // A cancellation won the race and was recorded before this approval — discard it, even
      // though the operator already said yes.
      return { outcome: { confirmed: false, reason: "cancelled" }, operationHash };
    }
    return { outcome: { confirmed: true }, operationHash };
  }
  if (response.kind === "timed-out") {
    return { outcome: { confirmed: false, reason: "timed-out" }, operationHash };
  }
  return { outcome: { confirmed: false, reason: "rejected" }, operationHash };
}
