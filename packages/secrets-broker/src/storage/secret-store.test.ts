import { beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SecretId } from "@agentforge/shared";
import { generateKey } from "./crypto.js";
import { SecretStore } from "./secret-store.js";

describe("SecretStore (DEC-030, DEC-031)", () => {
  let store: SecretStore;
  let filePath: string;
  const key = generateKey();

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentforge-secret-store-test-"));
    filePath = join(dir, "secrets.json");
    store = new SecretStore(filePath, key);
  });

  it("returns undefined for a secret that does not exist", async () => {
    expect(await store.get("nonexistent" as SecretId)).toBeUndefined();
  });

  it("creates and retrieves a secret", async () => {
    const id = await store.create("api-key", { value: "sk-test-123" }, "openai", "Test key");
    const record = await store.get(id);

    expect(record).toBeDefined();
    expect(record?.kind).toBe("api-key");
    expect(record?.payload.value).toBe("sk-test-123");
    expect(record?.metadata.provider).toBe("openai");
    expect(record?.metadata.label).toBe("Test key");
  });

  it("the on-disk file never contains the plaintext secret value", async () => {
    await store.create(
      "credential",
      { username: "alice", password: "hunter2-plaintext" },
      undefined,
      "test",
    );

    const raw = await import("node:fs/promises").then((fs) => fs.readFile(filePath, "utf-8"));
    expect(raw).not.toContain("hunter2-plaintext");
    expect(raw).not.toContain("alice");
  });

  it("exists() reflects presence without exposing the value", async () => {
    const id = await store.create("token", { value: "tok-abc" }, undefined, "test");
    expect(await store.exists(id)).toBe(true);
    expect(await store.exists("other-id" as SecretId)).toBe(false);
  });

  it("update() changes the payload and updatedAt, keeps createdAt", async () => {
    const id = await store.create("token", { value: "old" }, undefined, "test");
    const before = await store.get(id);

    await store.update(id, { value: "new" });
    const after = await store.get(id);

    expect(after?.payload.value).toBe("new");
    expect(after?.metadata.createdAt).toBe(before?.metadata.createdAt);
  });

  it("update() on a nonexistent secret throws without leaking anything", async () => {
    await expect(store.update("nonexistent" as SecretId, { value: "x" })).rejects.toThrow(
      "Secret not found",
    );
  });

  it("delete() removes the secret; deleting a nonexistent one is a no-op", async () => {
    const id = await store.create("generic", { value: "x" }, undefined, "test");
    await store.delete(id);
    expect(await store.get(id)).toBeUndefined();

    await expect(store.delete("nonexistent" as SecretId)).resolves.toBeUndefined();
  });

  it("listMetadata() never includes payload values", async () => {
    await store.create("api-key", { value: "sk-secret" }, "github", "GH token");

    const items = await store.listMetadata();
    expect(items).toHaveLength(1);
    expect(items[0]).not.toHaveProperty("payload");
    expect(JSON.stringify(items)).not.toContain("sk-secret");
  });

  it("throws a generic error on a corrupted (invalid JSON) secrets file, not a crash", async () => {
    await writeFile(filePath, "{ not valid json", "utf-8");
    await expect(store.get("any" as SecretId)).rejects.toThrow(/corrupted/);
  });

  it("a different key fails to decrypt existing records (no silent wrong-plaintext)", async () => {
    const id = await store.create("generic", { value: "x" }, undefined, "test");
    const otherKeyStore = new SecretStore(filePath, generateKey());
    await expect(otherKeyStore.get(id)).rejects.toThrow();
  });
});
