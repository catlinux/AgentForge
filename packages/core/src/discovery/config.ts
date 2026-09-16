import { readFile } from "node:fs/promises";
import type { QualifiedName } from "@agentforge/shared";

/**
 * Declarative Discovery configuration (DEC-019) — a JSON file separate from the Registry's own
 * origin configuration, so "what origins exist" (Registry) and "what is exposed to the agent"
 * (Discovery) never share a document.
 */
export interface DiscoveryConfig {
  /** Qualified names active for exposure. A tool absent from this list is not exposed. */
  readonly activeQualifiedNames: readonly QualifiedName[];
}

export async function loadDiscoveryConfig(configFilePath: string): Promise<DiscoveryConfig> {
  const raw = await readFile(configFilePath, "utf-8");
  const parsed = JSON.parse(raw) as DiscoveryConfig;
  return { activeQualifiedNames: parsed.activeQualifiedNames ?? [] };
}
