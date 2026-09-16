import { beforeEach, describe, expect, it } from "vitest";
import type { ToolContract, ToolEntry, ToolOrigin } from "@agentforge/shared";
import { computeSchemaFingerprint, toQualifiedName } from "@agentforge/shared";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileToolRegistryStore } from "../registry/file-store.js";
import { discoverTools } from "./discover.js";
import { StaticConfigDiscoveryStrategy } from "./static-strategy.js";
import type { DiscoveryConfig } from "./config.js";

const contract: ToolContract = {
  description: "Reads a file",
  inputSchema: { type: "object", properties: { path: { type: "string" } } },
};
const origin: ToolOrigin = { id: "mcp-fs", kind: "mcp-server" };

function makeEntry(name: string, overrides: Partial<ToolEntry> = {}): ToolEntry {
  return {
    identity: randomUUID() as ToolEntry["identity"],
    origin,
    qualifiedName: toQualifiedName(origin.id, name),
    contract,
    schemaFingerprint: computeSchemaFingerprint(contract),
    previousSchemaFingerprint: undefined,
    stale: false,
    ...overrides,
  };
}

describe("discoverTools", () => {
  let store: FileToolRegistryStore;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentforge-discovery-test-"));
    store = new FileToolRegistryStore(join(dir, "cache.json"));
  });

  it("returns an empty result for an empty catalog, without error", async () => {
    const config: DiscoveryConfig = { activeQualifiedNames: [] };
    const result = await discoverTools(store, new StaticConfigDiscoveryStrategy(config));
    expect(result).toEqual([]);
  });

  it("includes active tools and excludes inactive ones (DEC-018 static filter)", async () => {
    const active = makeEntry("read_file");
    const inactive = makeEntry("delete_file");
    await store.upsert(active);
    await store.upsert(inactive);

    const config: DiscoveryConfig = { activeQualifiedNames: [active.qualifiedName] };
    const result = await discoverTools(store, new StaticConfigDiscoveryStrategy(config));

    expect(result).toHaveLength(1);
    expect(result[0]?.qualifiedName).toBe(active.qualifiedName);
  });

  it("excludes stale entries automatically, even if active in config (DEC-021)", async () => {
    const staleButActive = makeEntry("old_tool", { stale: true });
    await store.upsert(staleButActive);

    const config: DiscoveryConfig = { activeQualifiedNames: [staleButActive.qualifiedName] };
    const result = await discoverTools(store, new StaticConfigDiscoveryStrategy(config));

    expect(result).toEqual([]);
  });

  it("output is a reduced projection, never exposing identity or schemaFingerprint (DEC-020)", async () => {
    const entry = makeEntry("read_file");
    await store.upsert(entry);

    const config: DiscoveryConfig = { activeQualifiedNames: [entry.qualifiedName] };
    const [view] = await discoverTools(store, new StaticConfigDiscoveryStrategy(config));

    expect(view).toBeDefined();
    expect(view).not.toHaveProperty("identity");
    expect(view).not.toHaveProperty("schemaFingerprint");
    expect(view).toEqual({
      qualifiedName: entry.qualifiedName,
      description: entry.contract.description,
      inputSchema: entry.contract.inputSchema,
    });
  });

  it("is read-only: does not mutate the Registry store", async () => {
    const entry = makeEntry("read_file");
    await store.upsert(entry);
    const before = await store.list();

    const config: DiscoveryConfig = { activeQualifiedNames: [entry.qualifiedName] };
    await discoverTools(store, new StaticConfigDiscoveryStrategy(config));

    const after = await store.list();
    expect(after).toEqual(before);
  });
});
