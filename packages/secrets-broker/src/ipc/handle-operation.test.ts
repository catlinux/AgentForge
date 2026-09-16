import { beforeEach, describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SecretId } from "@agentforge/shared";
import { generateKey } from "../storage/crypto.js";
import { SecretStore } from "../storage/secret-store.js";
import { handleOperation } from "./handle-operation.js";

describe("handleOperation (DEC-033 API, DEC-034 no binding)", () => {
  let store: SecretStore;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentforge-handle-op-test-"));
    store = new SecretStore(join(dir, "secrets.json"), generateKey());
  });

  it("get: returns not-found without leaking any internal detail", async () => {
    const result = await handleOperation(store, { type: "get", id: "nope" as SecretId });
    expect(result).toEqual({ ok: false, error: "Secret not found" });
  });

  it("create: rejects an invalid kind", async () => {
    const result = await handleOperation(store, {
      type: "create",
      kind: "not-a-real-kind" as never,
      payload: { value: "x" },
      provider: undefined,
      label: "test",
    });
    expect(result.ok).toBe(false);
  });

  it("create: rejects an empty payload", async () => {
    const result = await handleOperation(store, {
      type: "create",
      kind: "api-key",
      payload: {},
      provider: undefined,
      label: "test",
    });
    expect(result.ok).toBe(false);
  });

  it("create: rejects a missing label", async () => {
    const result = await handleOperation(store, {
      type: "create",
      kind: "api-key",
      payload: { value: "x" },
      provider: undefined,
      label: "",
    });
    expect(result.ok).toBe(false);
  });

  it("create -> get: full round trip through the operation handler", async () => {
    const created = await handleOperation(store, {
      type: "create",
      kind: "api-key",
      payload: { value: "sk-123" },
      provider: "openai",
      label: "Test",
    });
    expect(created.ok).toBe(true);
    if (created.ok && created.type === "create") {
      const fetched = await handleOperation(store, { type: "get", id: created.id });
      expect(fetched.ok).toBe(true);
      if (fetched.ok && fetched.type === "get") {
        expect(fetched.record.payload.value).toBe("sk-123");
      }
    }
  });

  it("exists: reflects true/false correctly", async () => {
    const created = await handleOperation(store, {
      type: "create",
      kind: "generic",
      payload: { value: "x" },
      provider: undefined,
      label: "test",
    });
    if (created.ok && created.type === "create") {
      const exists = await handleOperation(store, { type: "exists", id: created.id });
      expect(exists).toEqual({ ok: true, type: "exists", exists: true });
    }
    const notExists = await handleOperation(store, { type: "exists", id: "nope" as SecretId });
    expect(notExists).toEqual({ ok: true, type: "exists", exists: false });
  });

  it("list-metadata: never includes payload values in the result", async () => {
    await handleOperation(store, {
      type: "create",
      kind: "api-key",
      payload: { value: "sk-super-secret" },
      provider: undefined,
      label: "test",
    });
    const result = await handleOperation(store, { type: "list-metadata" });
    expect(JSON.stringify(result)).not.toContain("sk-super-secret");
  });

  it("delete: succeeds even for a nonexistent id (idempotent, no error leak)", async () => {
    const result = await handleOperation(store, { type: "delete", id: "nope" as SecretId });
    expect(result).toEqual({ ok: true, type: "delete" });
  });

  it("an internal failure degrades to a generic error, never leaking the underlying message", async () => {
    // An invalid path (embedded NUL byte) makes the underlying fs call throw — handleOperation's
    // catch-all must turn that into a generic, detail-free error, not surface the raw fs error.
    const brokenStore = new SecretStore("\0invalid-path", generateKey());
    const result = await handleOperation(brokenStore, { type: "get", id: "x" as SecretId });
    expect(result).toEqual({ ok: false, error: "Secrets Broker operation failed" });
    expect(JSON.stringify(result)).not.toContain("invalid-path");
    expect(JSON.stringify(result)).not.toMatch(/ENOENT|EINVAL|ERR_INVALID_ARG/);
  });

  it("DEC-034: no origin/identity binding is enforced — any authenticated request is served", async () => {
    // There is no `allowedOrigins`-style field anywhere in the operation contract; this test
    // documents that omission is intentional by asserting a bare get/create round trip needs no
    // such context.
    const created = await handleOperation(store, {
      type: "create",
      kind: "generic",
      payload: { value: "x" },
      provider: undefined,
      label: "test",
    });
    expect(created.ok).toBe(true);
    expect(created).not.toHaveProperty("allowedOrigins");
  });
});
