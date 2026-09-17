import type { DiscoveredToolView } from "@agentforge/shared";
import { resolveDiscoveryConfigPath, resolveRegistryCachePath } from "@agentforge/shared";
import {
  discoverTools,
  FileToolRegistryStore,
  loadDiscoveryConfig,
  StaticConfigDiscoveryStrategy,
} from "@agentforge/core";

/**
 * Reads what Tool Discovery would currently expose (DEC-064) — reuses `discoverTools` and
 * `StaticConfigDiscoveryStrategy` exactly as Core does, over the same Registry cache file, rather
 * than reimplementing the stale-exclusion/filter logic here.
 */
export async function readDiscoveredTools(): Promise<readonly DiscoveredToolView[]> {
  const store = new FileToolRegistryStore(resolveRegistryCachePath());
  const config = await loadDiscoveryConfig(resolveDiscoveryConfigPath()).catch(() => ({
    activeQualifiedNames: [],
  }));
  const strategy = new StaticConfigDiscoveryStrategy(config);
  return discoverTools(store, strategy);
}
