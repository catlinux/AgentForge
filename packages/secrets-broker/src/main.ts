import { homedir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:net";
import { MasterKeyStore } from "./storage/master-key.js";
import { SecretStore } from "./storage/secret-store.js";
import { startExecutionSecretsServer } from "./ipc/execution-secrets-server.js";
import { executionSecretsChannelPath } from "@agentforge/shared";

/**
 * Same `AGENTFORGE_DATA_DIR` convention as `resolveAuditLogPath`/`resolveRegistryCachePath`
 * (`packages/shared/src/paths/resolve-path.ts`), kept local here because the master key and
 * secrets files are Broker-only concerns, never read by any other process.
 */
export function dataDir(): string {
  return process.env["AGENTFORGE_DATA_DIR"] ?? join(homedir(), ".agentforge");
}

/**
 * Builds the real storage layer and starts the Execution Backend <-> Secrets Broker channel
 * (Fase 13, DEC-070) on `socketPath`. Extracted from `main()` so it is directly testable without
 * spawning a process — same real `MasterKeyStore`/`SecretStore`/`startExecutionSecretsServer`
 * code, just parameterized on where data/socket live.
 */
export async function startSecretsBroker(dataDirPath: string, socketPath: string): Promise<Server> {
  const masterKeyStore = new MasterKeyStore(join(dataDirPath, "secrets-broker", "master.key"));
  const masterKey = await masterKeyStore.loadOrCreate();
  const store = new SecretStore(join(dataDirPath, "secrets-broker", "secrets.enc.json"), masterKey);
  return startExecutionSecretsServer(store, socketPath);
}

/**
 * Minimal real entrypoint for the Secrets Broker process (DEC-004: separate OS process/user from
 * Core). Starts only the Execution Backend <-> Secrets Broker channel (Fase 13, DEC-070) — the
 * Core <-> Broker transport (DEC-010) stays an intentional placeholder (Fase 16, DEC-080): no
 * code in `packages/core` calls it.
 */
async function main(): Promise<void> {
  await startSecretsBroker(dataDir(), executionSecretsChannelPath());
}

main().catch((error: unknown) => {
  // No stdout/stderr content ever includes secret material (DEC-030) — this only surfaces
  // startup failures (e.g. a corrupted master key file), never secret values.
  console.error("agentforge-secrets-broker failed to start:", error);
  process.exitCode = 1;
});
