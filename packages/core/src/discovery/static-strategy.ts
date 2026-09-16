import type { ToolEntry } from "@agentforge/shared";
import type { DiscoveryConfig } from "./config.js";
import type { DiscoveryStrategy } from "./strategy.js";

/** Static-by-configuration reduction strategy (DEC-018, A1). */
export class StaticConfigDiscoveryStrategy implements DiscoveryStrategy {
  constructor(private readonly config: DiscoveryConfig) {}

  select(candidates: readonly ToolEntry[]): readonly ToolEntry[] {
    const active = new Set(this.config.activeQualifiedNames);
    return candidates.filter((entry) => active.has(entry.qualifiedName));
  }
}
