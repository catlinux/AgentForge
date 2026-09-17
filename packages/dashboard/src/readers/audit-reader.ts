import { readFile } from "node:fs/promises";
import type { AuditEvent } from "@agentforge/shared";
import { type AuditProcessName, resolveAuditLogPath } from "@agentforge/shared";

const AUDIT_PROCESS_NAMES: readonly AuditProcessName[] = [
  "mcp-server",
  "execution-ssh",
  "connector-github",
];

/**
 * Reads one process's Audit Log JSON Lines file (DEC-053) and returns its parsed events, most
 * recent first. Read-only (DEC-064) — this module never writes anything. Tolerant of a missing
 * file (no process has written yet) and of individual corrupt lines (skipped, never aborting the
 * whole read) — the same best-effort spirit as the writer side (DEC-057), applied to reading.
 */
export async function readAuditLog(processName: AuditProcessName): Promise<readonly AuditEvent[]> {
  let raw: string;
  try {
    raw = await readFile(resolveAuditLogPath(processName), "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const events: AuditEvent[] = [];
  for (const line of raw.split("\n")) {
    if (line.trim().length === 0) continue;
    try {
      events.push(JSON.parse(line) as AuditEvent);
    } catch {
      // Skip a corrupt line rather than failing the whole read (read-side best effort).
    }
  }
  return events.reverse();
}

/** Reads and merges the Audit Log of every known writer process (DEC-052), sorted newest first. */
export async function readAllAuditLogs(): Promise<readonly AuditEvent[]> {
  const perProcess = await Promise.all(AUDIT_PROCESS_NAMES.map((name) => readAuditLog(name)));
  return perProcess
    .flat()
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
