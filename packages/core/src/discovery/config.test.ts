import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDiscoveryConfig } from "./config.js";

describe("loadDiscoveryConfig", () => {
  it("loads active qualified names from a JSON file (DEC-019)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentforge-discovery-config-test-"));
    const path = join(dir, "discovery.json");
    await writeFile(path, JSON.stringify({ activeQualifiedNames: ["mcp-fs:read_file"] }), "utf-8");

    const config = await loadDiscoveryConfig(path);
    expect(config.activeQualifiedNames).toEqual(["mcp-fs:read_file"]);
  });

  it("defaults to an empty list when the field is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentforge-discovery-config-test-"));
    const path = join(dir, "discovery.json");
    await writeFile(path, JSON.stringify({}), "utf-8");

    const config = await loadDiscoveryConfig(path);
    expect(config.activeQualifiedNames).toEqual([]);
  });
});
