import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:os";
import type {
  ExecutionChannelRequest,
  PolicyDecision,
  SchemaFingerprint,
  ToolIdentity,
} from "@agentforge/shared";
import { NetExecutionChannelClient } from "./execution-client.js";

const identity = "tool-1" as ToolIdentity;
const fingerprint = "fp-1" as SchemaFingerprint;

function testSocketPath(): string {
  // Windows named pipes and POSIX sockets both accept an arbitrary path-like string here for
  // testing purposes via node:net — using a temp-dir-based name keeps tests isolated.
  if (platform() === "win32") {
    return `\\\\.\\pipe\\agentforge-test-${Date.now()}-${Math.random()}`;
  }
  return join(tmpdir(), `agentforge-test-${Date.now()}-${Math.random()}.sock`);
}

function decision(): PolicyDecision {
  return {
    verdict: "allow",
    ruleApplied: "risk-default",
    baseRisk: "read-only",
    identity,
    schemaFingerprint: fingerprint,
  };
}

function req(): ExecutionChannelRequest {
  return { identity, hostId: "host-1", parameters: { path: "/a" }, decision: decision() };
}

describe("NetExecutionChannelClient (DEC-047)", () => {
  let server: Server | undefined;
  let socketPath: string;

  beforeEach(() => {
    socketPath = testSocketPath();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
    server = undefined;
  });

  it("Execution unavailable: connect() rejects, never silently proceeds", async () => {
    const client = new NetExecutionChannelClient(socketPath);
    await expect(client.connect()).rejects.toBeDefined();
  });

  it("request() before connect() fails closed", async () => {
    const client = new NetExecutionChannelClient(socketPath);
    const response = await client.request(req());
    expect(response).toEqual({ ok: false, reason: "Not connected to Execution" });
  });

  it("round trip: a well-formed server response is delivered", async () => {
    server = createServer((socket: Socket) => {
      socket.on("data", () => {
        socket.write(
          `${JSON.stringify({ ok: true, outcome: { kind: "executed", exitCode: 0, stdout: "hi", stderr: "" } })}\n`,
        );
      });
    });
    await new Promise<void>((resolve) => server?.listen(socketPath, resolve));

    const client = new NetExecutionChannelClient(socketPath);
    await client.connect();
    const response = await client.request(req());
    expect(response).toEqual({
      ok: true,
      outcome: { kind: "executed", exitCode: 0, stdout: "hi", stderr: "" },
    });
    await client.close();
  });

  it("connection lost mid-operation (server closes without responding): fails closed", async () => {
    server = createServer((socket: Socket) => {
      socket.on("data", () => {
        socket.destroy(); // simulate Execution crashing mid-request, no response sent
      });
    });
    await new Promise<void>((resolve) => server?.listen(socketPath, resolve));

    const client = new NetExecutionChannelClient(socketPath);
    await client.connect();
    const response = await client.request(req());
    expect(response.ok).toBe(false);
    await client.close();
  });

  it("malformed response from the server fails closed rather than crashing", async () => {
    server = createServer((socket: Socket) => {
      socket.on("data", () => {
        socket.write("not valid json\n");
      });
    });
    await new Promise<void>((resolve) => server?.listen(socketPath, resolve));

    const client = new NetExecutionChannelClient(socketPath);
    await client.connect();
    const response = await client.request(req());
    expect(response).toEqual({ ok: false, reason: "Malformed response from Execution" });
    await client.close();
  });

  it("reconnecting after a simulated Execution restart establishes a fresh connection", async () => {
    server = createServer((socket: Socket) => {
      socket.on("data", () => {
        socket.write(
          `${JSON.stringify({ ok: true, outcome: { kind: "executed", exitCode: 0, stdout: "", stderr: "" } })}\n`,
        );
      });
    });
    await new Promise<void>((resolve) => server?.listen(socketPath, resolve));

    const client1 = new NetExecutionChannelClient(socketPath);
    await client1.connect();
    await client1.close();

    // Simulate Execution process restart: same path, new server instance.
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = createServer((socket: Socket) => {
      socket.on("data", () => {
        socket.write(
          `${JSON.stringify({ ok: true, outcome: { kind: "executed", exitCode: 0, stdout: "restarted", stderr: "" } })}\n`,
        );
      });
    });
    await new Promise<void>((resolve) => server?.listen(socketPath, resolve));

    const client2 = new NetExecutionChannelClient(socketPath);
    await client2.connect();
    const response = await client2.request(req());
    expect(response.ok).toBe(true);
    await client2.close();
  });
});
