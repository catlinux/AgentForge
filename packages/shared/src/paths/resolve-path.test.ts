import { describe, expect, it, afterEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveAuditLogPath } from "./resolve-path.js";

describe("resolveAuditLogPath", () => {
  const originalDataDir = process.env["AGENTFORGE_DATA_DIR"];

  afterEach(() => {
    if (originalDataDir === undefined) {
      delete process.env["AGENTFORGE_DATA_DIR"];
    } else {
      process.env["AGENTFORGE_DATA_DIR"] = originalDataDir;
    }
  });

  it("defaults to ~/.agentforge/audit/<process>.jsonl", () => {
    delete process.env["AGENTFORGE_DATA_DIR"];
    expect(resolveAuditLogPath("mcp-server")).toBe(
      join(homedir(), ".agentforge", "audit", "mcp-server.jsonl"),
    );
  });

  it("uses AGENTFORGE_DATA_DIR when set", () => {
    process.env["AGENTFORGE_DATA_DIR"] = join("custom", "data-dir");
    expect(resolveAuditLogPath("execution-ssh")).toBe(
      join("custom", "data-dir", "audit", "execution-ssh.jsonl"),
    );
  });

  it("produces a distinct path per process name", () => {
    delete process.env["AGENTFORGE_DATA_DIR"];
    const paths = new Set([
      resolveAuditLogPath("mcp-server"),
      resolveAuditLogPath("execution-ssh"),
      resolveAuditLogPath("connector-github"),
    ]);
    expect(paths.size).toBe(3);
  });
});
