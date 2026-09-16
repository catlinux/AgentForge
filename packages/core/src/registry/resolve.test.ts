import { beforeEach, describe, expect, it } from "vitest";
import type { ToolContract, ToolOrigin } from "@agentforge/shared";
import { FileToolRegistryStore } from "./file-store.js";
import { resolveDiscoveredTool } from "./resolve.js";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const contractV1: ToolContract = {
  description: "Reads a file",
  inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
};

const contractV2: ToolContract = {
  description: "Reads a file",
  inputSchema: {
    type: "object",
    properties: { path: { type: "string" }, encoding: { type: "string" } },
    required: ["path"],
  },
};

describe("resolveDiscoveredTool (DEC-016 rules)", () => {
  let cacheDir: string;
  let store: FileToolRegistryStore;
  const originA: ToolOrigin = { id: "mcp-fs-a", kind: "mcp-server" };
  const originB: ToolOrigin = { id: "mcp-fs-b", kind: "mcp-server" };

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), "agentforge-registry-test-"));
    store = new FileToolRegistryStore(join(cacheDir, "cache.json"));
  });

  it("case 2: first sighting of a tool creates a new identity", async () => {
    const outcome = await resolveDiscoveredTool(store, originA, {
      reportedName: "read_file",
      contract: contractV1,
    });
    expect(outcome.kind).toBe("new");
  });

  it("case 3: a server restart with the same origin+name resolves to the same identity", async () => {
    const first = await resolveDiscoveredTool(store, originA, {
      reportedName: "read_file",
      contract: contractV1,
    });
    await store.upsert(first.entry);

    const second = await resolveDiscoveredTool(store, originA, {
      reportedName: "read_file",
      contract: contractV1,
    });
    expect(second.kind).toBe("known");
    expect(second.entry.identity).toBe(first.entry.identity);
  });

  it("case 4: a renamed tool under the same origin is NOT auto-merged into the old identity", async () => {
    const original = await resolveDiscoveredTool(store, originA, {
      reportedName: "read_file",
      contract: contractV1,
    });
    await store.upsert(original.entry);

    const renamed = await resolveDiscoveredTool(store, originA, {
      reportedName: "read_file_v2",
      contract: contractV1,
    });
    expect(renamed.kind).toBe("new");
    expect(renamed.entry.identity).not.toBe(original.entry.identity);
  });

  it("case 5: a changed inputSchema is surfaced as schemaChanged, without creating a new identity", async () => {
    const first = await resolveDiscoveredTool(store, originA, {
      reportedName: "read_file",
      contract: contractV1,
    });
    await store.upsert(first.entry);

    const changed = await resolveDiscoveredTool(store, originA, {
      reportedName: "read_file",
      contract: contractV2,
    });
    expect(changed.kind).toBe("known");
    if (changed.kind === "known") {
      expect(changed.schemaChanged).toBe(true);
      expect(changed.entry.identity).toBe(first.entry.identity);
      expect(changed.entry.previousSchemaFingerprint).toBe(first.entry.schemaFingerprint);
    }
  });

  it("case 7: swapping the server behind the same origin id does not blindly inherit identity for a differing contract", async () => {
    const originalServer = await resolveDiscoveredTool(store, originA, {
      reportedName: "read_file",
      contract: contractV1,
    });
    await store.upsert(originalServer.entry);

    // Same origin id, same reported name, but a different underlying server (simulated by a
    // different contract) — per DEC-016 this still resolves to the same identity (matching is by
    // origin+name, not by server fingerprint), but the schema change MUST be surfaced, not hidden.
    const replacement = await resolveDiscoveredTool(store, originA, {
      reportedName: "read_file",
      contract: contractV2,
    });
    expect(replacement.kind).toBe("known");
    if (replacement.kind === "known") {
      expect(replacement.schemaChanged).toBe(true);
    }
  });

  it("case 8: two different origins with the same reported name never collide", async () => {
    const fromA = await resolveDiscoveredTool(store, originA, {
      reportedName: "execute",
      contract: contractV1,
    });
    await store.upsert(fromA.entry);

    const fromB = await resolveDiscoveredTool(store, originB, {
      reportedName: "execute",
      contract: contractV1,
    });
    expect(fromB.kind).toBe("new");
    expect(fromB.entry.identity).not.toBe(fromA.entry.identity);
    expect(fromB.entry.qualifiedName).not.toBe(fromA.entry.qualifiedName);
  });

  it("case 9: a compromised origin cannot claim another origin's qualified name/identity", async () => {
    const legitimate = await resolveDiscoveredTool(store, originA, {
      reportedName: "trusted_tool",
      contract: contractV1,
    });
    await store.upsert(legitimate.entry);

    // originB (a different configured origin) reports a tool with the exact same reported name.
    // It must never resolve to originA's identity, regardless of name equality.
    const impersonationAttempt = await resolveDiscoveredTool(store, originB, {
      reportedName: "trusted_tool",
      contract: contractV1,
    });
    expect(impersonationAttempt.kind).toBe("new");
    expect(impersonationAttempt.entry.identity).not.toBe(legitimate.entry.identity);
  });

  it("identity values are never derived from origin or reported name (opaque, AgentForge-generated)", async () => {
    const outcome = await resolveDiscoveredTool(store, originA, {
      reportedName: "read_file",
      contract: contractV1,
    });
    expect(outcome.entry.identity).not.toContain("read_file");
    expect(outcome.entry.identity).not.toContain(originA.id);
  });
});
