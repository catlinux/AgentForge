import {
  FileToolRegistryStore,
  StaticConfigDiscoveryStrategy,
  discoverTools,
  evaluate,
  loadDiscoveryConfig,
  loadPolicyConfig,
  InMemoryPolicyApprovalStore,
  type DiscoveryConfig,
  type PolicyConfig,
} from "@agentforge/core";
import { platform } from "node:os";
import { join } from "node:path";
import {
  resolveDiscoveryConfigPath,
  resolvePolicyConfigPath,
  resolveRegistryCachePath,
  type ExecutionChannelClient,
} from "@agentforge/shared";
import { NetExecutionChannelClient } from "./execution-client.js";
import { startStdioServer, type McpServerDeps } from "./server.js";

/**
 * Fixed channel paths for each Execution Backend process (DEC-047: single instance, no
 * discovery). Kept in sync by name with `execution-ssh/src/ipc/pipe-path.ts` and
 * `connector-github/src/ipc/pipe-path.ts` — not imported from those packages, since the MCP
 * server never depends on a backend's code, only on its channel (DEC-047's process separation).
 */
function executionChannelPath(): string {
  return platform() === "win32"
    ? "\\\\.\\pipe\\agentforge-execution"
    : join("/tmp", "agentforge-execution.sock");
}
function connectorChannelPath(): string {
  return platform() === "win32"
    ? "\\\\.\\pipe\\agentforge-connector-github"
    : join("/tmp", "agentforge-connector-github.sock");
}

async function loadDiscoveryConfigOrEmpty(path: string): Promise<DiscoveryConfig> {
  try {
    return await loadDiscoveryConfig(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { activeQualifiedNames: [] };
    }
    throw error;
  }
}

async function loadPolicyConfigOrEmpty(path: string): Promise<PolicyConfig> {
  try {
    return await loadPolicyConfig(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { riskByIdentity: {}, overrides: {} };
    }
    throw error;
  }
}

/**
 * Builds real `McpServerDeps` wiring the already existing Registry/Discovery/Policy Engine
 * (`packages/core`) and resolving one `ExecutionChannelClient` per Execution Backend by
 * `ToolEntry.origin.id` (DEC-058/059) — connecting lazily, same fail-closed behavior as each
 * backend's own channel client when a backend process is not running. Extracted from `main()`
 * so the real wiring is directly testable without starting stdio/the SDK transport. Reads paths
 * via the shared `AGENTFORGE_DATA_DIR` convention (`resolveRegistryCachePath` et al.) — the same
 * environment variable a test can override, same as every other process in this project.
 */
export async function buildMcpServerDeps(): Promise<McpServerDeps> {
  const registryStore = new FileToolRegistryStore(resolveRegistryCachePath());
  const discoveryConfig = await loadDiscoveryConfigOrEmpty(resolveDiscoveryConfigPath());
  const discoveryStrategy = new StaticConfigDiscoveryStrategy(discoveryConfig);
  const policyConfig = await loadPolicyConfigOrEmpty(resolvePolicyConfigPath());
  const approvals = new InMemoryPolicyApprovalStore();

  const executionClients = new Map<string, ExecutionChannelClient>([
    ["execution-ssh", new NetExecutionChannelClient(executionChannelPath())],
    ["connector-github", new NetExecutionChannelClient(connectorChannelPath())],
  ]);

  return {
    discover: () => discoverTools(registryStore, discoveryStrategy),
    resolveToolEntry: async (mcpToolName) => {
      const entries = await registryStore.list();
      return entries.find((entry) => !entry.stale && entry.qualifiedName === mcpToolName);
    },
    evaluate: (entry) => evaluate(entry, policyConfig, approvals),
    resolveExecutionClient: (originId) => executionClients.get(originId),
    resolveHostId: (args) => (typeof args["hostId"] === "string" ? args["hostId"] : ""),
    progressIntervalMs: 5_000,
  };
}

/**
 * Minimal real entrypoint for the MCP server process (DEC-043/044/046).
 */
async function main(): Promise<void> {
  const deps = await buildMcpServerDeps();
  await startStdioServer(deps);
}

main().catch((error: unknown) => {
  // DEC-046: stdout is reserved exclusively for MCP protocol frames. `console.*` is banned
  // package-wide (no-stdout-pollution.test.ts) to make that invariant impossible to violate by
  // accident — this writes the startup failure to stderr directly instead.
  process.stderr.write(`agentforge-mcp-server failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
