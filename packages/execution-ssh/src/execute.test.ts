import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AuditEventInput,
  AuditWriter,
  ExecutionRequest,
  OperationId,
  PolicyDecision,
  SchemaFingerprint,
  SecretId,
  SecretRecord,
  SessionId,
  ToolIdentity,
} from "@agentforge/shared";
import type {
  ConfirmationChannel,
  ConfirmationResponse,
} from "./confirmation/confirmation-channel.js";
import { OperationHashRegistry } from "./confirmation/hash-registry.js";
import type { CommandTemplate } from "./config/command-template.js";
import type { ExecutionConfig, HostEntry } from "./config/host-config.js";

vi.mock("./ssh/client.js", () => ({
  executeOverSsh: vi.fn(async () => ({
    exitCode: 0,
    stdout: "ok",
    stderr: "",
    stdoutTruncated: false,
    stderrTruncated: false,
    stdoutBytes: 2,
    stderrBytes: 0,
  })),
}));

/** Minimal test double of AuditWriter (DEC-057): captures events instead of writing to disk. */
class RecordingAuditWriter {
  readonly events: AuditEventInput[] = [];
  async write(event: AuditEventInput): Promise<void> {
    this.events.push(event);
  }
}

const { execute } = await import("./execute.js");
const { executeOverSsh } = await import("./ssh/client.js");

const identity = "tool-1" as ToolIdentity;
const fingerprint = "fp-1" as SchemaFingerprint;
const sessionId = "session-1" as SessionId;
const operationId = "operation-1" as OperationId;

const host: HostEntry = {
  hostId: "host-1",
  hostname: "example.internal",
  port: 22,
  username: "deploy",
  sshKeySecretId: "secret-1" as SecretId,
};

const config: ExecutionConfig = {
  hosts: [host],
  commandTemplates: { [identity]: { argv: ["cat", "{{path}}"] } as CommandTemplate },
};

const sshKeySecret: SecretRecord = {
  id: "secret-1" as SecretId,
  kind: "ssh-key",
  payload: {
    privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----",
  },
  metadata: { provider: undefined, label: "test", createdAt: "now", updatedAt: "now" },
};

function makeRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    identity,
    hostId: "host-1",
    parameters: { path: "/a" },
    sessionId,
    operationId,
    ...overrides,
  };
}

function allowDecision(overrides: Partial<PolicyDecision> = {}): PolicyDecision {
  return {
    verdict: "allow",
    ruleApplied: "risk-default",
    baseRisk: "read-only",
    identity,
    schemaFingerprint: fingerprint,
    ...overrides,
  };
}

function makeDeps(response: ConfirmationResponse, auditWriter?: RecordingAuditWriter) {
  const channel: ConfirmationChannel = {
    requestConfirmation: vi.fn(async () => response),
  };
  return {
    config,
    confirmationChannel: channel,
    confirmationRegistry: new OperationHashRegistry(),
    confirmationTimeoutMs: 1000,
    sshTimeoutMs: 1000,
    getSshKeySecret: vi.fn(async () => sshKeySecret),
    ...(auditWriter !== undefined ? { auditWriter: auditWriter as unknown as AuditWriter } : {}),
  };
}

describe("execute (Fase 7 orchestrator)", () => {
  beforeEach(() => {
    vi.mocked(executeOverSsh).mockClear();
  });

  it("verdict allow: executes over SSH without requiring confirmation", async () => {
    const deps = makeDeps({ kind: "approved" });
    const result = await execute(makeRequest(), allowDecision(), deps);

    expect(result).toEqual({
      kind: "executed",
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      stdoutTruncated: false,
      stderrTruncated: false,
      stdoutBytes: 2,
      stderrBytes: 0,
    });
    expect(deps.confirmationChannel.requestConfirmation).not.toHaveBeenCalled();
  });

  it("verdict allow: never calls confirmOperation, so no confirmation-requested/resolved event is written", async () => {
    const auditWriter = new RecordingAuditWriter();
    const deps = makeDeps({ kind: "approved" }, auditWriter);
    await execute(makeRequest(), allowDecision(), deps);

    expect(auditWriter.events.filter((e) => e.type.startsWith("confirmation-"))).toHaveLength(0);
  });

  it("verdict requires-confirmation + approved: writes confirmation-requested then confirmation-resolved(approved)", async () => {
    const auditWriter = new RecordingAuditWriter();
    const deps = makeDeps({ kind: "approved" }, auditWriter);
    await execute(
      makeRequest(),
      allowDecision({ verdict: "requires-confirmation", baseRisk: "destructive" }),
      deps,
    );

    expect(auditWriter.events.map((e) => e.type)).toEqual([
      "confirmation-requested",
      "confirmation-resolved",
    ]);
    const resolved = auditWriter.events[1];
    expect(resolved?.type === "confirmation-resolved" && resolved.reason).toBe("approved");
    expect(auditWriter.events.every((e) => e.operationId === operationId)).toBe(true);
    expect(auditWriter.events.every((e) => e.sessionId === sessionId)).toBe(true);
  });

  it("verdict requires-confirmation + rejected: writes confirmation-resolved(rejected)", async () => {
    const auditWriter = new RecordingAuditWriter();
    const deps = makeDeps({ kind: "rejected" }, auditWriter);
    await execute(makeRequest(), allowDecision({ verdict: "requires-confirmation" }), deps);

    const resolved = auditWriter.events.find((e) => e.type === "confirmation-resolved");
    expect(resolved?.type === "confirmation-resolved" && resolved.reason).toBe("rejected");
  });

  it("verdict requires-confirmation + timeout: writes confirmation-resolved(timed-out)", async () => {
    const auditWriter = new RecordingAuditWriter();
    const deps = makeDeps({ kind: "timed-out" }, auditWriter);
    await execute(makeRequest(), allowDecision({ verdict: "requires-confirmation" }), deps);

    const resolved = auditWriter.events.find((e) => e.type === "confirmation-resolved");
    expect(resolved?.type === "confirmation-resolved" && resolved.reason).toBe("timed-out");
  });

  it("hash already used: skips the channel and writes confirmation-resolved(already-used), no confirmation-requested", async () => {
    const auditWriter = new RecordingAuditWriter();
    const deps = makeDeps({ kind: "approved" }, auditWriter);
    await execute(makeRequest(), allowDecision({ verdict: "requires-confirmation" }), deps);
    auditWriter.events.length = 0;

    await execute(makeRequest(), allowDecision({ verdict: "requires-confirmation" }), deps);

    expect(auditWriter.events.map((e) => e.type)).toEqual(["confirmation-resolved"]);
    const resolved = auditWriter.events[0];
    expect(resolved?.type === "confirmation-resolved" && resolved.reason).toBe("already-used");
  });

  it("verdict deny: never touches SSH or the Secrets Broker", async () => {
    const deps = makeDeps({ kind: "approved" });
    const result = await execute(
      makeRequest(),
      allowDecision({ verdict: "deny", ruleApplied: "override-deny" }),
      deps,
    );

    expect(result.kind).toBe("denied");
    expect(deps.getSshKeySecret).not.toHaveBeenCalled();
    expect(vi.mocked(executeOverSsh)).not.toHaveBeenCalled();
  });

  it("verdict requires-confirmation + approved: executes", async () => {
    const deps = makeDeps({ kind: "approved" });
    const result = await execute(
      makeRequest(),
      allowDecision({
        verdict: "requires-confirmation",
        ruleApplied: "risk-default",
        baseRisk: "destructive",
      }),
      deps,
    );

    expect(result.kind).toBe("executed");
    expect(deps.confirmationChannel.requestConfirmation).toHaveBeenCalledTimes(1);
  });

  it("verdict requires-confirmation + rejected: never reaches SSH", async () => {
    const deps = makeDeps({ kind: "rejected" });
    const result = await execute(
      makeRequest(),
      allowDecision({ verdict: "requires-confirmation" }),
      deps,
    );

    expect(result).toEqual({ kind: "confirmation-required-but-missing", reason: "rejected" });
    expect(vi.mocked(executeOverSsh)).not.toHaveBeenCalled();
  });

  it("verdict requires-confirmation + timeout: denies by default, never falls back to allow", async () => {
    const deps = makeDeps({ kind: "timed-out" });
    const result = await execute(
      makeRequest(),
      allowDecision({ verdict: "requires-confirmation" }),
      deps,
    );

    expect(result).toEqual({ kind: "confirmation-required-but-missing", reason: "timed-out" });
  });

  it("unknown host fails without contacting the Secrets Broker or SSH", async () => {
    const deps = makeDeps({ kind: "approved" });
    const result = await execute(makeRequest({ hostId: "unknown-host" }), allowDecision(), deps);

    expect(result).toEqual({ kind: "failed", reason: "Unknown host" });
    expect(deps.getSshKeySecret).not.toHaveBeenCalled();
  });

  it("missing command template for the identity fails safely", async () => {
    const deps = makeDeps({ kind: "approved" });
    const emptyConfig: ExecutionConfig = { hosts: [host], commandTemplates: {} };
    const result = await execute(makeRequest(), allowDecision(), { ...deps, config: emptyConfig });

    expect(result.kind).toBe("failed");
  });

  it("parameters not matching the template fail safely (never fall through to execution)", async () => {
    const deps = makeDeps({ kind: "approved" });
    const result = await execute(
      makeRequest({ parameters: { path: "/a", unexpected: "x" } }),
      allowDecision(),
      deps,
    );

    expect(result.kind).toBe("failed");
    expect(vi.mocked(executeOverSsh)).not.toHaveBeenCalled();
  });
});
