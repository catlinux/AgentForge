import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connect, type Server, type Socket } from "node:net";
import { mkdtemp } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import type { SecretId } from "@agentforge/shared";
import { generateKey } from "../storage/crypto.js";
import { SecretStore } from "../storage/secret-store.js";
import { startExecutionSecretsServer } from "./execution-secrets-server.js";

function testSocketPath(): string {
  if (platform() === "win32") {
    return `\\\\.\\pipe\\agentforge-secretsserver-test-${Date.now()}-${Math.random()}`;
  }
  return join(tmpdir(), `agentforge-secretsserver-test-${Date.now()}-${Math.random()}.sock`);
}

function readOneLine(socket: Socket): Promise<string> {
  return new Promise((resolve) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      const idx = buffer.indexOf("\n");
      if (idx !== -1) resolve(buffer.slice(0, idx));
    });
  });
}

describe("startExecutionSecretsServer (Fase 13, DEC-F)", () => {
  let server: Server | undefined;
  let socketPath: string;
  let store: SecretStore;

  beforeEach(async () => {
    socketPath = testSocketPath();
    const dir = await mkdtemp(join(tmpdir(), "agentforge-secrets-server-test-"));
    store = new SecretStore(join(dir, "secrets.json"), generateKey());
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
    server = undefined;
  });

  it("returns the secret record for a known id", async () => {
    const id = await store.create("ssh-key", { privateKey: "fake-key-material" }, undefined, "t");
    server = startExecutionSecretsServer(store, socketPath);
    const socket = connect(socketPath);
    await new Promise((resolve) => socket.once("connect", resolve));

    socket.write(`${JSON.stringify({ id })}\n`);
    const response = JSON.parse(await readOneLine(socket)) as {
      ok: boolean;
      record?: { payload: Record<string, string> };
    };

    expect(response.ok).toBe(true);
    expect(response.record?.payload.privateKey).toBe("fake-key-material");
    socket.destroy();
  });

  it("responds ok:false for an unknown id, never throwing", async () => {
    server = startExecutionSecretsServer(store, socketPath);
    const socket = connect(socketPath);
    await new Promise((resolve) => socket.once("connect", resolve));

    socket.write(`${JSON.stringify({ id: "does-not-exist" as SecretId })}\n`);
    const response = JSON.parse(await readOneLine(socket)) as { ok: boolean; reason?: string };

    expect(response.ok).toBe(false);
    expect(response.reason).toBe("Secret not found");
    socket.destroy();
  });

  it("responds ok:false for a malformed message, never crashing the server", async () => {
    server = startExecutionSecretsServer(store, socketPath);
    const socket = connect(socketPath);
    await new Promise((resolve) => socket.once("connect", resolve));

    socket.write("not-json\n");
    const response = JSON.parse(await readOneLine(socket)) as { ok: boolean; reason?: string };

    expect(response.ok).toBe(false);
    expect(response.reason).toBe("Malformed request");
    socket.destroy();
  });

  it("never includes the secret payload in an error response", async () => {
    server = startExecutionSecretsServer(store, socketPath);
    const socket = connect(socketPath);
    await new Promise((resolve) => socket.once("connect", resolve));

    socket.write(`${JSON.stringify({ id: "missing" as SecretId })}\n`);
    const raw = await readOneLine(socket);

    expect(raw).not.toContain("privateKey");
    expect(raw).not.toContain("payload");
    socket.destroy();
  });
});
