import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
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
  })),
}));

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

function makeDeps(response: ConfirmationResponse) {
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
    });
    expect(deps.confirmationChannel.requestConfirmation).not.toHaveBeenCalled();
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
