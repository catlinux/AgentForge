import type { PolicyDecision, RiskLevel, ToolEntry } from "@agentforge/shared";
import type { PolicyApprovalStore } from "./approval-store.js";
import type { PolicyConfig } from "./config.js";

function verdictForRisk(risk: RiskLevel): "allow" | "requires-confirmation" {
  switch (risk) {
    case "read-only":
      return "allow";
    case "reversible-write":
      return "allow";
    case "destructive":
      return "requires-confirmation";
  }
}

/**
 * Evaluates a single tool invocation and produces a ternary decision (DEC-025). Read-only over
 * the Registry entry passed in — never mutates it. Does not execute anything, does not persist
 * or emit audit events (DEC-027); the in-memory approval store (DEC-026) is only used to detect
 * a `schemaFingerprint` change since the last `allow`, not as an audit trail.
 */
export async function evaluate(
  entry: ToolEntry,
  config: PolicyConfig,
  approvals: PolicyApprovalStore,
): Promise<PolicyDecision> {
  const { identity, schemaFingerprint } = entry;

  // DEC-026: any schemaFingerprint change since the last recorded approval invalidates it,
  // regardless of risk/overrides — no compatibility heuristic.
  const approvedFingerprint = await approvals.getApprovedFingerprint(identity);
  if (approvedFingerprint !== undefined && approvedFingerprint !== schemaFingerprint) {
    return {
      verdict: "requires-confirmation",
      ruleApplied: "schema-fingerprint-changed",
      baseRisk: config.riskByIdentity[identity],
      identity,
      schemaFingerprint,
    };
  }

  // DEC-024: overrides take precedence over the risk-derived default.
  const override = config.overrides[identity];
  if (override === "deny") {
    return {
      verdict: "deny",
      ruleApplied: "override-deny",
      baseRisk: config.riskByIdentity[identity],
      identity,
      schemaFingerprint,
    };
  }
  if (override === "allow") {
    await approvals.recordApproval(identity, schemaFingerprint);
    return {
      verdict: "allow",
      ruleApplied: "override-allow",
      baseRisk: config.riskByIdentity[identity],
      identity,
      schemaFingerprint,
    };
  }

  // DEC-023: unclassified identity → conservative default, never auto-allow.
  const baseRisk = config.riskByIdentity[identity];
  if (baseRisk === undefined) {
    return {
      verdict: "requires-confirmation",
      ruleApplied: "unclassified-default",
      baseRisk: undefined,
      identity,
      schemaFingerprint,
    };
  }

  const verdict = verdictForRisk(baseRisk);
  if (verdict === "allow") {
    await approvals.recordApproval(identity, schemaFingerprint);
  }
  return {
    verdict,
    ruleApplied: "risk-default",
    baseRisk,
    identity,
    schemaFingerprint,
  };
}
