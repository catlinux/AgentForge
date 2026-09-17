import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAllAuditLogs, readAuditLog } from "./audit-reader.js";

describe("readAuditLog (DEC-064)", () => {
  let dataDir: string;
  let originalDataDir: string | undefined;

  beforeEach(async () => {
    originalDataDir = process.env["AGENTFORGE_DATA_DIR"];
    dataDir = await mkdtemp(join(tmpdir(), "agentforge-audit-reader-test-"));
    process.env["AGENTFORGE_DATA_DIR"] = dataDir;
  });

  afterEach(async () => {
    if (originalDataDir === undefined) delete process.env["AGENTFORGE_DATA_DIR"];
    else process.env["AGENTFORGE_DATA_DIR"] = originalDataDir;
    await rm(dataDir, { recursive: true, force: true });
  });

  it("returns an empty list when the file does not exist", async () => {
    expect(await readAuditLog("mcp-server")).toEqual([]);
  });

  it("parses valid JSON Lines and returns them newest first", async () => {
    const dir = join(dataDir, "audit");
    await mkdir(dir, { recursive: true });
    const lineA = JSON.stringify({ type: "tool-invoked", timestamp: "2026-01-01T00:00:00.000Z" });
    const lineB = JSON.stringify({ type: "tool-invoked", timestamp: "2026-01-02T00:00:00.000Z" });
    await writeFile(join(dir, "mcp-server.jsonl"), `${lineA}\n${lineB}\n`, "utf-8");

    const events = await readAuditLog("mcp-server");
    expect(events).toHaveLength(2);
    expect(events[0]?.timestamp).toBe("2026-01-02T00:00:00.000Z");
  });

  it("skips a corrupt line instead of failing the whole read", async () => {
    const dir = join(dataDir, "audit");
    await mkdir(dir, { recursive: true });
    const validLine = JSON.stringify({
      type: "tool-invoked",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    await writeFile(join(dir, "mcp-server.jsonl"), `not-json\n${validLine}\n`, "utf-8");

    const events = await readAuditLog("mcp-server");
    expect(events).toHaveLength(1);
  });
});

describe("readAllAuditLogs (DEC-064)", () => {
  let dataDir: string;
  let originalDataDir: string | undefined;

  beforeEach(async () => {
    originalDataDir = process.env["AGENTFORGE_DATA_DIR"];
    dataDir = await mkdtemp(join(tmpdir(), "agentforge-audit-reader-test-"));
    process.env["AGENTFORGE_DATA_DIR"] = dataDir;
  });

  afterEach(async () => {
    if (originalDataDir === undefined) delete process.env["AGENTFORGE_DATA_DIR"];
    else process.env["AGENTFORGE_DATA_DIR"] = originalDataDir;
    await rm(dataDir, { recursive: true, force: true });
  });

  it("merges events from all writer processes, newest first", async () => {
    const dir = join(dataDir, "audit");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "mcp-server.jsonl"),
      `${JSON.stringify({ type: "tool-invoked", timestamp: "2026-01-01T00:00:00.000Z" })}\n`,
      "utf-8",
    );
    await writeFile(
      join(dir, "execution-ssh.jsonl"),
      `${JSON.stringify({ type: "execution-completed", timestamp: "2026-01-03T00:00:00.000Z" })}\n`,
      "utf-8",
    );

    const events = await readAllAuditLogs();
    expect(events).toHaveLength(2);
    expect(events[0]?.timestamp).toBe("2026-01-03T00:00:00.000Z");
  });
});
