import type { SchemaFingerprint, ToolIdentity } from "../registry/identity.js";
import type { RiskLevel } from "./risk.js";

/** Ternary policy decision (DEC-025). The Policy Engine decides; it never executes. */
export type PolicyVerdict = "allow" | "deny" | "requires-confirmation";

/** Which mechanism produced the verdict (DEC-024, DEC-026). */
export type PolicyRuleApplied =
  | "risk-default"
  | "override-allow"
  | "override-deny"
  | "unclassified-default"
  | "schema-fingerprint-changed";

/** Structured reason accompanying every decision (DEC-025) — minimum fields required. */
export interface PolicyDecision {
  readonly verdict: PolicyVerdict;
  readonly ruleApplied: PolicyRuleApplied;
  readonly baseRisk: RiskLevel | undefined;
  readonly identity: ToolIdentity;
  readonly schemaFingerprint: SchemaFingerprint;
}
