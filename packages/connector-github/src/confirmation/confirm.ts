import type {
  AuditWriter,
  OperationId,
  SchemaFingerprint,
  SessionId,
  ToolIdentity,
} from "@agentforge/shared";
import type { ConfirmationChannel } from "./confirmation-channel.js";
import { computeOperationHash, type OperationHash } from "./operation-hash.js";
import type { OperationHashRegistry } from "./hash-registry.js";
import type { PendingConfirmations } from "./pending-confirmations.js";

export interface ConfirmationRequest {
  readonly identity: ToolIdentity;
  readonly parameters: Readonly<Record<string, string>>;
  readonly hostId: string;
  readonly accountLabel: string;
  readonly schemaFingerprint: SchemaFingerprint;
  readonly operationSummary: readonly string[];
  /** Correlation metadata only (DEC-054/056) — never participates in the hash, the registry, or
   * any confirmation decision below. Used solely to tag the audit events this function writes. */
  readonly sessionId: SessionId;
  readonly operationId: OperationId;
}

export type ConfirmationOutcome =
  | { readonly confirmed: true }
  | {
      readonly confirmed: false;
      readonly reason: "rejected" | "timed-out" | "already-used" | "cancelled";
    };

/**
 * Enforces DEC-038's security guarantees, extended by DEC-045 for MCP `tools/call` cancellation —
 * same construction as `execution-ssh/src/confirmation/confirm.ts` (see operation-hash.ts in this
 * package for why the confirmation machinery is duplicated per Execution Backend rather than
 * shared).
 */
export async function confirmOperation(
  request: ConfirmationRequest,
  channel: ConfirmationChannel,
  registry: OperationHashRegistry,
  timeoutMs: number,
  auditWriter?: AuditWriter,
  pendingConfirmations?: PendingConfirmations,
): Promise<{ outcome: ConfirmationOutcome; operationHash: OperationHash }> {
  const operationHash = computeOperationHash(
    request.identity,
    request.parameters,
    request.hostId,
    request.schemaFingerprint,
  );

  function resolved(
    reason: "approved" | "rejected" | "timed-out" | "already-used" | "cancelled",
  ): void {
    void auditWriter?.write({
      type: "confirmation-resolved",
      operationId: request.operationId,
      sessionId: request.sessionId,
      identity: request.identity,
      reason,
    });
  }

  const existing = registry.get(operationHash);
  if (existing === "used") {
    resolved("already-used");
    return { outcome: { confirmed: false, reason: "already-used" }, operationHash };
  }
  if (existing === "cancelled") {
    resolved("cancelled");
    return { outcome: { confirmed: false, reason: "cancelled" }, operationHash };
  }

  void auditWriter?.write({
    type: "confirmation-requested",
    operationId: request.operationId,
    sessionId: request.sessionId,
    identity: request.identity,
  });

  pendingConfirmations?.add(operationHash);
  let response;
  try {
    response = await channel.requestConfirmation(
      {
        operationHash,
        operationSummary: request.operationSummary,
        accountLabel: request.accountLabel,
      },
      timeoutMs,
    );
  } finally {
    pendingConfirmations?.remove(operationHash);
  }

  if (response.kind === "approved") {
    const marked = registry.markUsedIfNotCancelled(operationHash);
    if (!marked) {
      resolved("cancelled");
      return { outcome: { confirmed: false, reason: "cancelled" }, operationHash };
    }
    resolved("approved");
    return { outcome: { confirmed: true }, operationHash };
  }
  if (response.kind === "timed-out") {
    resolved("timed-out");
    return { outcome: { confirmed: false, reason: "timed-out" }, operationHash };
  }
  resolved("rejected");
  return { outcome: { confirmed: false, reason: "rejected" }, operationHash };
}
