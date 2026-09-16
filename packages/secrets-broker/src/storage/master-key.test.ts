import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:os";
import { assertRestrictivePermissions, MasterKeyStore } from "./master-key.js";
import { SECRET_KEY_LENGTH_BYTES } from "./crypto.js";

describe("MasterKeyStore (DEC-032)", () => {
  it("creates a new key on first use and persists it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentforge-master-key-test-"));
    const keyPath = join(dir, "master.key");
    const store = new MasterKeyStore(keyPath);

    const key = await store.loadOrCreate();
    expect(key.length).toBe(SECRET_KEY_LENGTH_BYTES);

    const onDisk = await readFile(keyPath);
    expect(onDisk.equals(key)).toBe(true);
  });

  it("returns the same key across separate loadOrCreate calls once persisted", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentforge-master-key-test-"));
    const keyPath = join(dir, "master.key");
    const store1 = new MasterKeyStore(keyPath);
    const first = await store1.loadOrCreate();

    const store2 = new MasterKeyStore(keyPath);
    const second = await store2.loadOrCreate();

    expect(first.equals(second)).toBe(true);
  });

  it("throws on a corrupted (wrong-length) key file, instead of silently accepting it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentforge-master-key-test-"));
    const keyPath = join(dir, "master.key");
    await writeFile(keyPath, Buffer.from("too-short"));

    const store = new MasterKeyStore(keyPath);
    await expect(store.loadOrCreate()).rejects.toThrow(/corrupted/);
  });

  it.skipIf(platform() === "win32")(
    "creates the key file with owner-only permissions on POSIX",
    async () => {
      const dir = await mkdtemp(join(tmpdir(), "agentforge-master-key-test-"));
      const keyPath = join(dir, "master.key");
      const store = new MasterKeyStore(keyPath);
      await store.loadOrCreate();

      const stats = await stat(keyPath);
      expect(stats.mode & 0o777).toBe(0o600);
      await expect(assertRestrictivePermissions(keyPath)).resolves.toBeUndefined();
    },
  );

  it.skipIf(platform() === "win32")(
    "assertRestrictivePermissions rejects an overly permissive key file",
    async () => {
      const dir = await mkdtemp(join(tmpdir(), "agentforge-master-key-test-"));
      const keyPath = join(dir, "master.key");
      await writeFile(keyPath, Buffer.alloc(SECRET_KEY_LENGTH_BYTES), { mode: 0o644 });

      await expect(assertRestrictivePermissions(keyPath)).rejects.toThrow(/permissive/);
    },
  );
});
