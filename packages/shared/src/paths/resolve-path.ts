import { homedir } from "node:os";
import { join } from "node:path";

/** Name of each real audit-writing process (DEC-052), used as the JSON Lines file basename. */
export type AuditProcessName = "mcp-server" | "execution-ssh" | "connector-github";

function dataDir(): string {
  return process.env["AGENTFORGE_DATA_DIR"] ?? join(homedir(), ".agentforge");
}

/**
 * Resolves the real on-disk path for a process's Audit Log file (DEC-053: one file per writer
 * process, JSON Lines, append-only). Bootstrap for DEC-065 — before this, `AuditWriter` was never
 * constructed with a real path anywhere outside its own unit test.
 *
 * Directory is overridable via `AGENTFORGE_DATA_DIR` (kept out of source, never hardcoded to a
 * real deployment path); defaults to `~/.agentforge` for local development. This function only
 * computes a path — it never creates the directory itself (`AuditWriter.write()` already does
 * `mkdir(..., { recursive: true })`).
 */
export function resolveAuditLogPath(processName: AuditProcessName): string {
  return join(dataDir(), "audit", `${processName}.jsonl`);
}

/**
 * Resolves the real on-disk path for the Tool Registry's cache file (DEC-014,
 * `FileToolRegistryStore`). Same `AGENTFORGE_DATA_DIR` convention as `resolveAuditLogPath`
 * (DEC-069) — read-only use by the Dashboard (DEC-064); does not itself change how
 * Registry/Discovery/Policy resolve their own paths in `packages/core`, which still take a path
 * parameter explicitly.
 */
export function resolveRegistryCachePath(): string {
  return join(dataDir(), "registry-cache.json");
}

/** Resolves the real on-disk path for the Tool Discovery configuration file (DEC-019, DEC-069). */
export function resolveDiscoveryConfigPath(): string {
  return join(dataDir(), "discovery-config.json");
}

/** Resolves the real on-disk path for the Policy Engine configuration file (DEC-028, DEC-069). */
export function resolvePolicyConfigPath(): string {
  return join(dataDir(), "policy-config.json");
}
