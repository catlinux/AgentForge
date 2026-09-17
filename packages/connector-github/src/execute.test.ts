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
import type { GithubOperationTemplate } from "./config/operation-template.js";
import type { ConnectorConfig, GithubAccountEntry } from "./config/account-config.js";

vi.mock("./github/client.js", () => ({
  sendGithubRequest: vi.fn(async () => ({
    statusCode: 201,
    responseBytes: 42,
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
const { sendGithubRequest } = await import("./github/client.js");

const identity = "tool-1" as ToolIdentity;
const fingerprint = "fp-1" as SchemaFingerprint;
const sessionId = "session-1" as SessionId;
const operationId = "operation-1" as OperationId;

const account: GithubAccountEntry = {
  accountId: "account-1",
  apiBaseUrl: "https://api.github.com",
  tokenSecretId: "secret-1" as SecretId,
};

const config: ConnectorConfig = {
  accounts: [account],
  operationTemplates: {
    [identity]: {
      method: "POST",
      path: "/repos/{{owner}}/{{repo}}/issues",
      bodyFields: ["title"],
    } as GithubOperationTemplate,
  },
};

const tokenSecret: SecretRecord = {
  id: "secret-1" as SecretId,
  kind: "token",
  payload: { value: "ghp_faketoken" },
  metadata: { provider: "github", label: "test", createdAt: "now", updatedAt: "now" },
};

function makeRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    identity,
    hostId: "account-1",
    parameters: { owner: "acme", repo: "widgets", title: "Bug" },
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
    httpTimeoutMs: 1000,
    getTokenSecret: vi.fn(async () => tokenSecret),
    ...(auditWriter !== undefined ? { auditWriter: auditWriter as unknown as AuditWriter } : {}),
  };
}

describe("execute (Fase 11 connector orchestrator)", () => {
  beforeEach(() => {
    vi.mocked(sendGithubRequest).mockClear();
  });

  it("verdict allow: sends the GitHub request without requiring confirmation", async () => {
    const deps = makeDeps({ kind: "approved" });
    const result = await execute(makeRequest(), allowDecision(), deps);

    expect(result).toEqual({ kind: "executed-http", statusCode: 201, responseBytes: 42 });
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
  });

  it("verdict requires-confirmation + rejected: writes confirmation-resolved(rejected), never calls the GitHub API", async () => {
    const auditWriter = new RecordingAuditWriter();
    const deps = makeDeps({ kind: "rejected" }, auditWriter);
    const result = await execute(
      makeRequest(),
      allowDecision({ verdict: "requires-confirmation" }),
      deps,
    );

    expect(result).toEqual({ kind: "confirmation-required-but-missing", reason: "rejected" });
    expect(vi.mocked(sendGithubRequest)).not.toHaveBeenCalled();
    const resolved = auditWriter.events.find((e) => e.type === "confirmation-resolved");
    expect(resolved?.type === "confirmation-resolved" && resolved.reason).toBe("rejected");
  });

  it("verdict requires-confirmation + timeout: denies by default", async () => {
    const deps = makeDeps({ kind: "timed-out" });
    const result = await execute(
      makeRequest(),
      allowDecision({ verdict: "requires-confirmation" }),
      deps,
    );

    expect(result).toEqual({ kind: "confirmation-required-but-missing", reason: "timed-out" });
  });

  it("verdict deny: never touches the GitHub API or the Secrets Broker", async () => {
    const deps = makeDeps({ kind: "approved" });
    const result = await execute(
      makeRequest(),
      allowDecision({ verdict: "deny", ruleApplied: "override-deny" }),
      deps,
    );

    expect(result.kind).toBe("denied");
    expect(deps.getTokenSecret).not.toHaveBeenCalled();
    expect(vi.mocked(sendGithubRequest)).not.toHaveBeenCalled();
  });

  it("unknown account fails without contacting the Secrets Broker or the GitHub API", async () => {
    const deps = makeDeps({ kind: "approved" });
    const result = await execute(makeRequest({ hostId: "unknown-account" }), allowDecision(), deps);

    expect(result).toEqual({ kind: "failed", reason: "Unknown account" });
    expect(deps.getTokenSecret).not.toHaveBeenCalled();
  });

  it("missing operation template for the identity fails safely", async () => {
    const deps = makeDeps({ kind: "approved" });
    const emptyConfig: ConnectorConfig = { accounts: [account], operationTemplates: {} };
    const result = await execute(makeRequest(), allowDecision(), { ...deps, config: emptyConfig });

    expect(result.kind).toBe("failed");
  });

  it("parameters not matching the template fail safely (never reach the GitHub API)", async () => {
    const deps = makeDeps({ kind: "approved" });
    const result = await execute(
      makeRequest({ parameters: { owner: "acme", repo: "widgets", title: "Bug", extra: "x" } }),
      allowDecision(),
      deps,
    );

    expect(result.kind).toBe("failed");
    expect(vi.mocked(sendGithubRequest)).not.toHaveBeenCalled();
  });

  it("never forwards free-form request shape: only declared template fields reach sendGithubRequest", async () => {
    const deps = makeDeps({ kind: "approved" });
    await execute(makeRequest(), allowDecision(), deps);

    expect(vi.mocked(sendGithubRequest)).toHaveBeenCalledWith(
      "https://api.github.com",
      "ghp_faketoken",
      { method: "POST", path: "/repos/acme/widgets/issues", body: { title: "Bug" } },
      1000,
    );
  });
});
