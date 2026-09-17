import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server, type Socket } from "node:net";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import type { SecretId } from "./identity.js";
import { NetExecutionSecretsChannelClient } from "./execution-secrets-client.js";

function testSocketPath(): string {
  if (platform() === "win32") {
    return `\\\\.\\pipe\\agentforge-secretsclient-test-${Date.now()}-${Math.random()}`;
  }
  return join(tmpdir(), `agentforge-secretsclient-test-${Date.now()}-${Math.random()}.sock`);
}

describe("NetExecutionSecretsChannelClient (Fase 13, DEC-F)", () => {
  let server: Server | undefined;
  let socketPath: string;

  beforeEach(() => {
    socketPath = testSocketPath();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
    server = undefined;
  });

  it("fails closed when not connected", async () => {
    const client = new NetExecutionSecretsChannelClient(socketPath);
    const response = await client.get("id-1" as SecretId);
    expect(response).toEqual({ ok: false, reason: "Not connected to Secrets Broker" });
  });

  it("completes a full round trip against a real socket", async () => {
    server = createServer((socket: Socket) => {
      socket.on("data", (chunk) => {
        const { id } = JSON.parse(chunk.toString("utf-8").trim()) as { id: SecretId };
        socket.write(
          `${JSON.stringify({
            ok: true,
            record: { id, kind: "token", payload: { value: "secret-value" }, metadata: {} },
          })}\n`,
        );
      });
    });
    server.listen(socketPath);
    await new Promise((resolve) => server?.once("listening", resolve));

    const client = new NetExecutionSecretsChannelClient(socketPath);
    await client.connect();
    const response = await client.get("id-1" as SecretId);

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.record.payload.value).toBe("secret-value");
    }
    await client.close();
  });

  it("fails closed when the connection is lost mid-request", async () => {
    server = createServer((socket: Socket) => {
      socket.on("data", () => {
        socket.destroy();
      });
    });
    server.listen(socketPath);
    await new Promise((resolve) => server?.once("listening", resolve));

    const client = new NetExecutionSecretsChannelClient(socketPath);
    await client.connect();
    const response = await client.get("id-1" as SecretId);

    expect(response).toEqual({ ok: false, reason: "Connection to Secrets Broker lost" });
    await client.close();
  });

  it("never crosses secrets between concurrent get() calls sharing one socket (Fase 13 hardening)", async () => {
    // The server deliberately answers the FIRST id it sees only after a delay, and the SECOND id
    // immediately — if `get()` were not serialized, the fast response for "id-fast" could resolve
    // while a listener meant for "id-slow" is still attached, handing the wrong secret to the
    // wrong caller (or vice versa). A FIFO queue must prevent this regardless of response timing.
    server = createServer((socket: Socket) => {
      let buffer = "";
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf-8");
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          const { id } = JSON.parse(line) as { id: SecretId };
          const respond = (): void => {
            socket.write(
              `${JSON.stringify({
                ok: true,
                record: { id, kind: "token", payload: { value: `value-for-${id}` }, metadata: {} },
              })}\n`,
            );
          };
          if (id === "id-slow") {
            setTimeout(respond, 30);
          } else {
            respond();
          }
        }
      });
    });
    server.listen(socketPath);
    await new Promise((resolve) => server?.once("listening", resolve));

    const client = new NetExecutionSecretsChannelClient(socketPath);
    await client.connect();

    const [slow, fast] = await Promise.all([
      client.get("id-slow" as SecretId),
      client.get("id-fast" as SecretId),
    ]);

    expect(slow.ok).toBe(true);
    expect(fast.ok).toBe(true);
    if (slow.ok) expect(slow.record.payload.value).toBe("value-for-id-slow");
    if (fast.ok) expect(fast.record.payload.value).toBe("value-for-id-fast");
    await client.close();
  });

  it("fails closed on a malformed response", async () => {
    server = createServer((socket: Socket) => {
      socket.on("data", () => {
        socket.write("not-json\n");
      });
    });
    server.listen(socketPath);
    await new Promise((resolve) => server?.once("listening", resolve));

    const client = new NetExecutionSecretsChannelClient(socketPath);
    await client.connect();
    const response = await client.get("id-1" as SecretId);

    expect(response).toEqual({ ok: false, reason: "Malformed response from Secrets Broker" });
    await client.close();
  });
});
