import type { SchemaFingerprint, ToolIdentity } from "@agentforge/shared";

/**
 * Tracks the `schemaFingerprint` last evaluated as approved (verdict `allow`) for each
 * `identity` (DEC-026). This is deliberately NOT an audit log (DEC-027: the Policy Engine does
 * not persist decisions for audit purposes) — it stores only the minimum needed to detect a
 * schema change and invalidate a stale approval, not a history of decisions.
 */
export interface PolicyApprovalStore {
  getApprovedFingerprint(identity: ToolIdentity): Promise<SchemaFingerprint | undefined>;
  recordApproval(identity: ToolIdentity, fingerprint: SchemaFingerprint): Promise<void>;
}

/** In-memory implementation — sufficient for this phase; no persistence is required by DEC-027. */
export class InMemoryPolicyApprovalStore implements PolicyApprovalStore {
  private readonly approved = new Map<ToolIdentity, SchemaFingerprint>();

  async getApprovedFingerprint(identity: ToolIdentity): Promise<SchemaFingerprint | undefined> {
    return this.approved.get(identity);
  }

  async recordApproval(identity: ToolIdentity, fingerprint: SchemaFingerprint): Promise<void> {
    this.approved.set(identity, fingerprint);
  }
}
