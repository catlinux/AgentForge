import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMcpServerDeps } from "./main.js";

describe("buildMcpServerDeps (Fase 16 real entrypoint)", () => {
  let dataDirPath: string | undefined;
  let previousDataDir: string | undefined;

  beforeEach(async () => {
    dataDirPath = await mkdtemp(join(tmpdir(), "agentforge-mcp-main-"));
    previousDataDir = process.env["AGENTFORGE_DATA_DIR"];
    process.env["AGENTFORGE_DATA_DIR"] = dataDirPath;
  });

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env["AGENTFORGE_DATA_DIR"];
    } else {
      process.env["AGENTFORGE_DATA_DIR"] = previousDataDir;
    }
    if (dataDirPath !== undefined) {
      await rm(dataDirPath, { recursive: true, force: true });
      dataDirPath = undefined;
    }
  });

  it("builds real deps against an empty data dir (no Registry/Discovery/Policy files yet)", async () => {
    const deps = await buildMcpServerDeps();

    await expect(deps.discover()).resolves.toEqual([]);
    await expect(deps.resolveToolEntry("nonexistent:tool")).resolves.toBeUndefined();
    expect(deps.resolveExecutionClient("execution-ssh")).toBeDefined();
    expect(deps.resolveExecutionClient("connector-github")).toBeDefined();
    expect(deps.resolveExecutionClient("unknown-origin")).toBeUndefined();
    expect(deps.resolveHostId({ hostId: "host-1" })).toBe("host-1");
    expect(deps.resolveHostId({})).toBe("");
  });
});
