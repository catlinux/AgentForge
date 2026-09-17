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
import { startConnectorServer } from "./connector-server.js";
import { OperationHashRegistry } from "../confirmation/hash-registry.js";
import type { ConfirmationChannel } from "../confirmation/confirmation-channel.js";
import type { ConnectorConfig, GithubAccountEntry } from "../config/account-config.js";
import type { GithubOperationTemplate } from "../config/operation-template.js";
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
    return `\\\\.\\pipe\\agentforge-connserver-test-${Date.now()}-${Math.random()}`;
  }
  return join(tmpdir(), `agentforge-connserver-test-${Date.now()}-${Math.random()}.sock`);
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
  const account: GithubAccountEntry = {
    accountId: "account-1",
    apiBaseUrl: "https://api.github.com",
    tokenSecretId: "secret-1" as SecretId,
  };
  const config: ConnectorConfig = {
    accounts: [account],
    operationTemplates: {
      [identity]: {
        method: "GET",
        path: "/repos/x/y/issues",
        bodyFields: [],
      } as GithubOperationTemplate,
    },
  };
  const channel: ConfirmationChannel = {
    requestConfirmation: async () => ({ kind: "approved" }),
  };
  return {
    config,
    confirmationChannel: channel,
    confirmationRegistry: new OperationHashRegistry(),
    confirmationTimeoutMs: 1000,
    httpTimeoutMs: 1000,
    getTokenSecret: async () => undefined, // no real Secrets Broker in tests — never touches the API
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

describe("startConnectorServer (DEC-047 pattern, DEC-058)", () => {
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
    server = startConnectorServer(deps, socketPath);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));
    socket.write("not valid json\n");

    const line = await readOneLine(socket);
    expect(JSON.parse(line)).toEqual({ ok: false, reason: "Malformed request" });
    socket.destroy();
  });

  it("syntactically valid but unexpectedly-shaped 'execute' message responds ok:false and never crashes the process (Fase 13 hardening)", async () => {
    const deps = makeDeps();
    server = startConnectorServer(deps, socketPath);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));
    socket.write(`${JSON.stringify({ kind: "execute" })}\n`);

    const line = await readOneLine(socket);
    expect(JSON.parse(line)).toEqual({ ok: false, reason: "Malformed request" });

    socket.write("not valid json\n");
    const secondLine = await readOneLine(socket);
    expect(JSON.parse(secondLine)).toEqual({ ok: false, reason: "Malformed request" });
    socket.destroy();
  });

  it("syntactically valid but unexpectedly-shaped 'cancel' message never crashes the process (Fase 13 hardening)", async () => {
    const deps = makeDeps();
    server = startConnectorServer(deps, socketPath);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));
    socket.write(`${JSON.stringify({ kind: "cancel", identity, hostId: "account-1" })}\n`);
    socket.write("not valid json\n");

    const line = await readOneLine(socket);
    expect(JSON.parse(line)).toEqual({ ok: false, reason: "Malformed request" });
    socket.destroy();
  });

  it("execute request with deny verdict never contacts the Secrets Broker", async () => {
    let secretRequested = false;
    const deps = {
      ...makeDeps(),
      getTokenSecret: async () => {
        secretRequested = true;
        return undefined;
      },
    };
    server = startConnectorServer(deps, socketPath);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));
    socket.write(
      `${JSON.stringify({
        kind: "execute",
        request: {
          identity,
          hostId: "account-1",
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
    server = startConnectorServer(deps, socketPath);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));
    socket.write(
      `${JSON.stringify({
        kind: "cancel",
        identity,
        hostId: "account-1",
        parameters: {},
        schemaFingerprint: fingerprint,
        sessionId,
        operationId,
      })}\n`,
    );
    await new Promise((r) => setTimeout(r, 20));

    socket.write(
      `${JSON.stringify({
        kind: "execute",
        request: {
          identity,
          hostId: "account-1",
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
    server = startConnectorServer(deps, socketPath, auditWriter as unknown as AuditWriter);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));
    socket.write(
      `${JSON.stringify({
        kind: "cancel",
        identity,
        hostId: "account-1",
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

  it("cancel message arriving while a confirmation is genuinely pending DOES write confirmation-resolved(cancelled)", async () => {
    const auditWriter = new RecordingAuditWriter();
    const neverResolvingChannel: ConfirmationChannel = {
      requestConfirmation: () => new Promise(() => {}),
    };
    const deps = { ...makeDeps(), confirmationChannel: neverResolvingChannel };
    server = startConnectorServer(deps, socketPath, auditWriter as unknown as AuditWriter);
    await new Promise((r) => setTimeout(r, 20));

    const socket = connect(socketPath);
    await new Promise((r) => socket.once("connect", r));
    socket.write(
      `${JSON.stringify({
        kind: "execute",
        request: {
          identity,
          hostId: "account-1",
          parameters: {},
          decision: decision({ verdict: "requires-confirmation" }),
          sessionId,
          operationId,
        },
      })}\n`,
    );
    await new Promise((r) => setTimeout(r, 20));
    auditWriter.events.length = 0;

    socket.write(
      `${JSON.stringify({
        kind: "cancel",
        identity,
        hostId: "account-1",
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

describe("startConnectorServer default audit writer (DEC-065)", () => {
  it("starts successfully without throwing when no auditWriter is injected", () => {
    const deps = makeDeps();
    const server = startConnectorServer(deps, testSocketPath());
    expect(server.listening).toBe(true);
    server.close();
  });
});

describe("startConnectorServer default Secrets Broker channel (Fase 13, DEC-F)", () => {
  it("starts successfully without throwing when no getTokenSecret is injected", () => {
    const { getTokenSecret, ...depsWithoutSecret } = makeDeps();
    void getTokenSecret;
    const server = startConnectorServer(depsWithoutSecret, testSocketPath());
    expect(server.listening).toBe(true);
    server.close();
  });
});
