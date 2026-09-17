import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connect, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:os";
import type {
  AuditEventInput,
  AuditWriter,
  OperationId,
  PolicyDecision,
  SchemaFingerprint,
  SecretId,
  SessionId,
  ToolIdentity,
} from "@agentforge/shared";
import { startExecutionServer } from "./execution-server.js";
import { OperationHashRegistry } from "../confirmation/hash-registry.js";
import type { ConfirmationChannel } from "../confirmation/confirmation-channel.js";
import type { ExecutionConfig, HostEntry } from "../config/host-config.js";
import type { CommandTemplate } from "../config/command-template.js";
import type { ExecuteDependencies } from "../execute.js";

const identity = "tool-1" as ToolIdentity;
const fingerprint = "fp-1" as SchemaFingerprint;
const sessionId = "session-1" as SessionId;
const operationId = "operation-1" as OperationId;

/** Minimal test double of AuditWriter (DEC-057): captures events instead of writing to disk. */
class RecordingAuditWriter {
  readonly events: AuditEventInput[] = [];
  async write(event: AuditEventInput): Promise<void> {
    this.events.push(event);
  }
}

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
        sessionId,
        operationId,
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
          sessionId,
          operationId,
        },
      })}\n`,
    );
    const line = await readOneLine(socket);
    const parsed = JSON.parse(line);
    expect(parsed.outcome.kind).toBe("confirmation-required-but-missing");
    expect(parsed.outcome.reason).toBe("cancelled");
    socket.destroy();
  });

  it("cancel message for an operation with no pending confirmation does NOT write a false confirmation-resolved event", async () => {
    const auditWriter = new RecordingAuditWriter();
    const deps = makeDeps();
    server = startExecutionServer(deps, socketPath, auditWriter as unknown as AuditWriter);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));
    // No confirmOperation() call ever happened for this tuple (e.g. cancelled before Execution
    // received any "execute" message, or the verdict never required confirmation at all) — the
    // registry has no entry for this hash.
    socket.write(
      `${JSON.stringify({
        kind: "cancel",
        identity,
        hostId: "host-1",
        parameters: {},
        schemaFingerprint: fingerprint,
        sessionId,
        operationId,
      })}\n`,
    );
    await new Promise((r) => setTimeout(r, 20));

    expect(auditWriter.events).toHaveLength(0);
    socket.destroy();
  });

  it('cancel message arriving after the confirmation was already resolved (hash marked "used") does NOT write a duplicate/false confirmation-resolved event', async () => {
    const auditWriter = new RecordingAuditWriter();
    const deps = makeDeps();
    server = startExecutionServer(deps, socketPath, auditWriter as unknown as AuditWriter);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));

    // First, a real confirmation flow runs to completion (approved) — this is the genuine
    // "pending confirmation" case, and confirmOperation() itself (Fase 10 fix #1) is responsible
    // for writing confirmation-requested/confirmation-resolved(approved) around it.
    socket.write(
      `${JSON.stringify({
        kind: "execute",
        request: {
          identity,
          hostId: "host-1",
          parameters: {},
          decision: decision({ verdict: "requires-confirmation" }),
          sessionId,
          operationId,
        },
      })}\n`,
    );
    await readOneLine(socket);
    auditWriter.events.length = 0; // isolate this test to what the cancel message alone writes

    // A cancel arriving afterwards for the exact same tuple: DEC-045 guarantee 5 says this must
    // not retroactively invalidate the already-approved execution — and per this fix, it must not
    // fabricate a second confirmation-resolved event either, since nothing was resolved by this
    // cancel (the hash is "used", cancelOperation() is a no-op, cancelling nothing).
    socket.write(
      `${JSON.stringify({
        kind: "cancel",
        identity,
        hostId: "host-1",
        parameters: {},
        schemaFingerprint: fingerprint,
        sessionId,
        operationId,
      })}\n`,
    );
    await new Promise((r) => setTimeout(r, 20));

    expect(auditWriter.events).toHaveLength(0);
    socket.destroy();
  });

  it("cancel message arriving while a confirmation is genuinely pending (operator has not answered yet) DOES write confirmation-resolved(cancelled)", async () => {
    const auditWriter = new RecordingAuditWriter();
    // A channel that never resolves — simulates the operator not having answered yet, so the
    // confirmation stays genuinely in flight (tracked by PendingConfirmations, Fase 10) until the
    // cancel arrives.
    const neverResolvingChannel: ConfirmationChannel = {
      requestConfirmation: () => new Promise(() => {}),
    };
    const deps = { ...makeDeps(), confirmationChannel: neverResolvingChannel };
    server = startExecutionServer(deps, socketPath, auditWriter as unknown as AuditWriter);
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
          decision: decision({ verdict: "requires-confirmation" }),
          sessionId,
          operationId,
        },
      })}\n`,
    );
    // No response read here — the "execute" request never resolves (channel never answers). Give
    // confirmOperation() time to reach PendingConfirmations.add() before cancelling.
    await new Promise((r) => setTimeout(r, 20));
    auditWriter.events.length = 0; // discard the confirmation-requested event written above

    socket.write(
      `${JSON.stringify({
        kind: "cancel",
        identity,
        hostId: "host-1",
        parameters: {},
        schemaFingerprint: fingerprint,
        sessionId,
        operationId,
      })}\n`,
    );
    await new Promise((r) => setTimeout(r, 20));

    expect(auditWriter.events).toHaveLength(1);
    expect(auditWriter.events[0]).toMatchObject({
      type: "confirmation-resolved",
      reason: "cancelled",
      identity,
    });
    socket.destroy();
  });
});

describe("startExecutionServer default audit writer (DEC-065)", () => {
  it("starts successfully without throwing when no auditWriter is injected", () => {
    const deps = makeDeps();
    const server = startExecutionServer(deps, testSocketPath());
    expect(server.listening).toBe(true);
    server.close();
  });
});
