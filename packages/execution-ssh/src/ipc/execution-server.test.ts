import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connect, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:os";
import type { PolicyDecision, SchemaFingerprint, SecretId, ToolIdentity } from "@agentforge/shared";
import { startExecutionServer } from "./execution-server.js";
import { OperationHashRegistry } from "../confirmation/hash-registry.js";
import type { ConfirmationChannel } from "../confirmation/confirmation-channel.js";
import type { ExecutionConfig, HostEntry } from "../config/host-config.js";
import type { CommandTemplate } from "../config/command-template.js";
import type { ExecuteDependencies } from "../execute.js";

const identity = "tool-1" as ToolIdentity;
const fingerprint = "fp-1" as SchemaFingerprint;

function testSocketPath(): string {
  if (platform() === "win32") {
    return `\\\\.\\pipe\\agentforge-execserver-test-${Date.now()}-${Math.random()}`;
  }
  return join(tmpdir(), `agentforge-execserver-test-${Date.now()}-${Math.random()}.sock`);
}

function decision(overrides: Partial<PolicyDecision> = {}): PolicyDecision {
  return {
    verdict: "allow",
    ruleApplied: "risk-default",
    baseRisk: "read-only",
    identity,
    schemaFingerprint: fingerprint,
    ...overrides,
  };
}

function makeDeps(): ExecuteDependencies & { confirmationRegistry: OperationHashRegistry } {
  const host: HostEntry = {
    hostId: "host-1",
    hostname: "example.internal",
    port: 22,
    username: "deploy",
    sshKeySecretId: "secret-1" as SecretId,
  };
  const config: ExecutionConfig = {
    hosts: [host],
    commandTemplates: { [identity]: { argv: ["echo", "hi"] } as CommandTemplate },
  };
  const channel: ConfirmationChannel = {
    requestConfirmation: async () => ({ kind: "approved" }),
  };
  return {
    config,
    confirmationChannel: channel,
    confirmationRegistry: new OperationHashRegistry(),
    confirmationTimeoutMs: 1000,
    sshTimeoutMs: 1000,
    getSshKeySecret: async () => undefined, // no real SSH credentials in tests — never touches SSH
  };
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

describe("startExecutionServer (DEC-047)", () => {
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

  it("malformed message responds with ok:false, never crashes the server", async () => {
    const deps = makeDeps();
    server = startExecutionServer(deps, socketPath);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));
    socket.write("not valid json\n");

    const line = await readOneLine(socket);
    expect(JSON.parse(line)).toEqual({ ok: false, reason: "Malformed request" });
    socket.destroy();
  });

  it("execute request with deny verdict never contacts the Secrets Broker", async () => {
    let secretRequested = false;
    const deps = {
      ...makeDeps(),
      getSshKeySecret: async () => {
        secretRequested = true;
        return undefined;
      },
    };
    server = startExecutionServer(deps, socketPath);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));
    socket.write(
      `${JSON.stringify({
        kind: "execute",
        request: {
          identity,
          hostId: "host-1",
          parameters: {},
          decision: decision({ verdict: "deny" }),
        },
      })}\n`,
    );

    const line = await readOneLine(socket);
    const parsed = JSON.parse(line);
    expect(parsed.ok).toBe(true);
    expect(parsed.outcome.kind).toBe("denied");
    expect(secretRequested).toBe(false);
    socket.destroy();
  });

  it("cancel message propagates to the confirmation registry (DEC-045)", async () => {
    const deps = makeDeps();
    server = startExecutionServer(deps, socketPath);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));
    socket.write(
      `${JSON.stringify({
        kind: "cancel",
        identity,
        hostId: "host-1",
        parameters: {},
        schemaFingerprint: fingerprint,
      })}\n`,
    );
    await new Promise((r) => setTimeout(r, 20));

    // A subsequent execute request requiring confirmation must now report the hash as cancelled.
    socket.write(
      `${JSON.stringify({
        kind: "execute",
        request: {
          identity,
          hostId: "host-1",
          parameters: {},
          decision: decision({ verdict: "requires-confirmation" }),
        },
      })}\n`,
    );
    const line = await readOneLine(socket);
    const parsed = JSON.parse(line);
    expect(parsed.outcome.kind).toBe("confirmation-required-but-missing");
    expect(parsed.outcome.reason).toBe("cancelled");
    socket.destroy();
  });
});
