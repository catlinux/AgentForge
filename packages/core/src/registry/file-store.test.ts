import { beforeEach, describe, expect, it } from "vitest";
import type { ToolContract, ToolEntry, ToolOrigin } from "@agentforge/shared";
import { computeSchemaFingerprint, toQualifiedName } from "@agentforge/shared";
import { FileToolRegistryStore } from "./file-store.js";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const contract: ToolContract = { description: "test", inputSchema: { type: "object" } };
const origin: ToolOrigin = { id: "mcp-test", kind: "mcp-server" };

function makeEntry(name: string): ToolEntry {
  return {
    identity: randomUUID() as ToolEntry["identity"],
    origin,
    qualifiedName: toQualifiedName(origin.id, name),
    contract,
    schemaFingerprint: computeSchemaFingerprint(contract),
    previousSchemaFingerprint: undefined,
    stale: false,
  };
}

describe("FileToolRegistryStore", () => {
  let store: FileToolRegistryStore;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentforge-registry-store-test-"));
    store = new FileToolRegistryStore(join(dir, "cache.json"));
  });

  it("returns an empty list when the cache file does not exist yet", async () => {
    expect(await store.list()).toEqual([]);
  });

  it("persists and retrieves entries by identity", async () => {
    const entry = makeEntry("tool_a");
    await store.upsert(entry);
    expect(await store.getByIdentity(entry.identity)).toEqual(entry);
  });

  it("case 6: entries for a temporarily unreachable origin are kept, not deleted, when marked stale", async () => {
    const entry = makeEntry("tool_a");
    await store.upsert(entry);

    await store.markStaleExcept(origin.id, []);

    const stillThere = await store.getByIdentity(entry.identity);
    expect(stillThere).toBeDefined();
    expect(stillThere?.stale).toBe(true);
  });

  it("markStaleExcept does not affect entries from other origins", async () => {
    const otherOrigin: ToolOrigin = { id: "mcp-other", kind: "mcp-server" };
    const entryOther: ToolEntry = { ...makeEntry("tool_b"), origin: otherOrigin };
    await store.upsert(entryOther);

    await store.markStaleExcept(origin.id, []);

    const stillFresh = await store.getByIdentity(entryOther.identity);
    expect(stillFresh?.stale).toBe(false);
  });
});
