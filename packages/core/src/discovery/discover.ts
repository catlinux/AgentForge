import type { DiscoveredToolView, ToolEntry } from "@agentforge/shared";
import type { ToolRegistryStore } from "../registry/store.js";
import type { DiscoveryStrategy } from "./strategy.js";

function toView(entry: ToolEntry): DiscoveredToolView {
  return {
    qualifiedName: entry.qualifiedName,
    description: entry.contract.description,
    inputSchema: entry.contract.inputSchema,
  };
}

/**
 * Tool Discovery entry point (Fase 4). Read-only over the Registry: never writes to
 * `ToolRegistryStore`, never mutates `stale`/`identity`/`schemaFingerprint`. Always excludes
 * `stale` entries (DEC-021) before handing candidates to the strategy (DEC-018), then projects
 * the result to `DiscoveredToolView` (DEC-020) — callers never see `ToolEntry` directly.
 */
export async function discoverTools(
  store: ToolRegistryStore,
  strategy: DiscoveryStrategy,
): Promise<readonly DiscoveredToolView[]> {
  const all = await store.list();
  const nonStale = all.filter((entry) => !entry.stale);
  const selected = strategy.select(nonStale);
  return selected.map(toView);
}
