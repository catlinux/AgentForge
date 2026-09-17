import type { PolicyConfig } from "@agentforge/core";
import { loadPolicyConfig } from "@agentforge/core";
import { resolvePolicyConfigPath } from "@agentforge/shared";

/**
 * Reads the Policy Engine's declarative configuration (DEC-028) — risk classification and
 * allow/deny overrides by `identity` — as-is, via the same loader Core itself uses (DEC-064).
 * Read-only: never calls `evaluate()`, never affects any real authorization decision.
 */
export async function readPolicyConfig(): Promise<PolicyConfig> {
  return loadPolicyConfig(resolvePolicyConfigPath()).catch(() => ({
    riskByIdentity: {},
    overrides: {},
  }));
}
