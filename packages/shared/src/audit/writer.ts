import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { AuditEventInput } from "./event.js";

/**
 * Best-effort, non-blocking JSON Lines writer (DEC-053, DEC-057). A failure to write an event
 * NEVER throws to the caller — the Audit Log is evidence, not a control mechanism, and must never
 * abort, block, or otherwise gate the real operation it describes. Each process (MCP server,
 * Execution) constructs its own `AuditWriter` pointed at its own file (DEC-052) — this class has
 * no knowledge of, and no dependency on, Policy Engine, `OperationHashRegistry`, or execution
 * logic (DEC-056).
 */
export class AuditWriter {
  constructor(private readonly filePath: string) {}

  /**
   * Writes one event as a single JSON line, appended to the file. Fills in `eventId` and
   * `timestamp` automatically. Never rejects — logs nothing further on failure (this class itself
   * must not depend on any other logging mechanism), simply returns.
   */
  async write(event: AuditEventInput): Promise<void> {
    try {
      const full = { ...event, eventId: randomUUID(), timestamp: new Date().toISOString() };
      const line = `${JSON.stringify(full)}\n`;
      await mkdir(dirname(this.filePath), { recursive: true });
      await appendFile(this.filePath, line, { mode: 0o600 });
    } catch {
      // Best effort (DEC-057): a failed write must never propagate and must never affect the
      // operation being audited.
    }
  }
}
