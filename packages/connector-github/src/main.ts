import { homedir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:net";
import { loadConnectorConfig, type ConnectorConfig } from "./config/account-config.js";
import { OperationHashRegistry } from "./confirmation/hash-registry.js";
import { ReadlineConfirmationChannel } from "./confirmation/readline-channel.js";
import { startConnectorServer } from "./ipc/connector-server.js";
import { connectorChannelPath } from "./ipc/pipe-path.js";

const CONFIRMATION_TIMEOUT_MS = 60_000;
const HTTP_TIMEOUT_MS = 30_000;

export function dataDir(): string {
  return process.env["AGENTFORGE_DATA_DIR"] ?? join(homedir(), ".agentforge");
}

async function loadConfigOrEmpty(configFilePath: string): Promise<ConnectorConfig> {
  try {
    return await loadConnectorConfig(configFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { accounts: [], operationTemplates: {} };
    }
    throw error;
  }
}

/**
 * Loads the real account configuration from `dataDirPath` and starts the real GitHub connector
 * IPC server on `socketPath`. Extracted from `main()` so it is directly testable without
 * spawning a process — `getTokenSecret` is left unset so `startConnectorServer` defaults it to a
 * real Secrets Broker channel client (Fase 13, DEC-070).
 */
export async function startConnectorGithub(
  dataDirPath: string,
  socketPath: string,
): Promise<Server> {
  const config = await loadConfigOrEmpty(
    join(dataDirPath, "connector-github", "account-config.json"),
  );
  return startConnectorServer(
    {
      config,
      confirmationChannel: new ReadlineConfirmationChannel(),
      confirmationRegistry: new OperationHashRegistry(),
      confirmationTimeoutMs: CONFIRMATION_TIMEOUT_MS,
      httpTimeoutMs: HTTP_TIMEOUT_MS,
    },
    socketPath,
  );
}

/**
 * Minimal real entrypoint for the GitHub connector process (DEC-058, DEC-047 pattern: a separate
 * process from the MCP server, started independently by the operator before confirmation-requiring
 * tools become usable).
 */
async function main(): Promise<void> {
  await startConnectorGithub(dataDir(), connectorChannelPath());
}

main().catch((error: unknown) => {
  console.error("agentforge-connector-github failed to start:", error);
  process.exitCode = 1;
});
