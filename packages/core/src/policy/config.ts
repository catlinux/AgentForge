import { readFile } from "node:fs/promises";
import type { RiskLevel, ToolIdentity } from "@agentforge/shared";

/**
 * Declarative Policy Engine configuration (DEC-028) — a JSON file separate from Registry's and
 * Discovery's own configuration files.
 *
 * `riskByIdentity` is the explicit, user-declared risk classification (DEC-023): the only
 * accepted source of truth. An `identity` absent from this map is treated as unclassified
 * (DEC-023, conservative default → `requires-confirmation`).
 *
 * `overrides` are the simple allow/deny overrides by `identity` (DEC-024) — no argument
 * conditions, no expressive rule language.
 */
export interface PolicyConfig {
  readonly riskByIdentity: Readonly<Record<ToolIdentity, RiskLevel>>;
  readonly overrides: Readonly<Record<ToolIdentity, "allow" | "deny">>;
}

export async function loadPolicyConfig(configFilePath: string): Promise<PolicyConfig> {
  const raw = await readFile(configFilePath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<PolicyConfig>;
  return {
    riskByIdentity: parsed.riskByIdentity ?? {},
    overrides: parsed.overrides ?? {},
  };
}
