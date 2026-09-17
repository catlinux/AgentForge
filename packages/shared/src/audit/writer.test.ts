import { beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OperationId } from "./operation-id.js";
import type { SessionId } from "../session/session-id.js";
import { AuditWriter } from "./writer.js";

const operationId = "operation-1" as OperationId;
const sessionId = "session-1" as SessionId;

describe("AuditWriter (DEC-053, DEC-057)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "agentforge-audit-writer-test-"));
  });

  it("appends one JSON line per event, filling in eventId and timestamp", async () => {
    const filePath = join(dir, "nested", "audit.jsonl");
    const writer = new AuditWriter(filePath);

    await writer.write({
      type: "tool-invoked",
      operationId,
      sessionId,
      mcpToolName: "mcp-fs:read_file",
      hostId: "host-1",
      parameterNames: ["path"],
    });
    await writer.write({
      type: "operation-cancelled",
      operationId,
      sessionId,
      phase: "before-execution",
    });

    const content = await readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
    expect(first.type).toBe("tool-invoked");
    expect(first.operationId).toBe(operationId);
    expect(first.sessionId).toBe(sessionId);
    expect(typeof first.eventId).toBe("string");
    expect(typeof first.timestamp).toBe("string");
  });

  it("creates the file with restrictive permissions (0o600) on POSIX", async () => {
    if (process.platform === "win32") {
      return; // POSIX file mode bits are not meaningful on Windows.
    }
    const filePath = join(dir, "audit.jsonl");
    const writer = new AuditWriter(filePath);
    await writer.write({
      type: "operation-cancelled",
      operationId,
      sessionId,
      phase: "before-execution",
    });

    const stats = await stat(filePath);
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it("never throws when the target path is unwritable (DEC-057: best-effort, non-blocking)", async () => {
    // A path under a file (not a directory) is not creatable — this must fail internally but
    // never reject, since Audit Log must never gate or abort the real operation it describes.
    const filePath = join(dir, "audit.jsonl");
    const writer = new AuditWriter(filePath);
    await writer.write({
      type: "operation-cancelled",
      operationId,
      sessionId,
      phase: "before-execution",
    });
    const impossiblePath = join(filePath, "nested.jsonl");
    const brokenWriter = new AuditWriter(impossiblePath);

    await expect(
      brokenWriter.write({
        type: "operation-cancelled",
        operationId,
        sessionId,
        phase: "before-execution",
      }),
    ).resolves.toBeUndefined();
  });
});
