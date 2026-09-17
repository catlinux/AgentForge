import { homedir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:net";
import { loadExecutionConfig, type ExecutionConfig } from "./config/host-config.js";
import { OperationHashRegistry } from "./confirmation/hash-registry.js";
import { ReadlineConfirmationChannel } from "./confirmation/readline-channel.js";
import { startExecutionServer } from "./ipc/execution-server.js";
import { executionChannelPath } from "./ipc/pipe-path.js";

const CONFIRMATION_TIMEOUT_MS = 60_000;
const SSH_TIMEOUT_MS = 30_000;

export function dataDir(): string {
  return process.env["AGENTFORGE_DATA_DIR"] ?? join(homedir(), ".agentforge");
}

async function loadConfigOrEmpty(configFilePath: string): Promise<ExecutionConfig> {
  try {
    return await loadExecutionConfig(configFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { hosts: [], commandTemplates: {} };
    }
    throw error;
  }
}

/**
 * Loads the real host configuration from `dataDirPath` and starts the real Execution SSH IPC
 * server on `socketPath`. Extracted from `main()` so it is directly testable without spawning a
 * process — `getSshKeySecret` is left unset so `startExecutionServer` defaults it to a real
 * Secrets Broker channel client (Fase 13, DEC-070).
 */
export async function startExecutionSsh(dataDirPath: string, socketPath: string): Promise<Server> {
  const config = await loadConfigOrEmpty(join(dataDirPath, "execution-ssh", "host-config.json"));
  return startExecutionServer(
    {
      config,
      confirmationChannel: new ReadlineConfirmationChannel(),
      confirmationRegistry: new OperationHashRegistry(),
      confirmationTimeoutMs: CONFIRMATION_TIMEOUT_MS,
      sshTimeoutMs: SSH_TIMEOUT_MS,
    },
    socketPath,
  );
}

/**
 * Minimal real entrypoint for the Execution SSH process (DEC-042, DEC-047: a separate process
 * from the MCP server, started independently by the operator before confirmation-requiring
 * tools become usable — see DEC-047).
 */
async function main(): Promise<void> {
  await startExecutionSsh(dataDir(), executionChannelPath());
}

main().catch((error: unknown) => {
  console.error("agentforge-execution-ssh failed to start:", error);
  process.exitCode = 1;
});
