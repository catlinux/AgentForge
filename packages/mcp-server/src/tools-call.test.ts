import { describe, expect, it, vi } from "vitest";
import type {
  ExecutionChannelClient,
  ExecutionChannelRequest,
  ExecutionChannelResponse,
  PolicyDecision,
  SchemaFingerprint,
  SessionId,
  ToolEntry,
  ToolIdentity,
  ToolOrigin,
} from "@agentforge/shared";
import { handleToolCall, type ToolsCallDeps } from "./tools-call.js";

const identity = "tool-1" as ToolIdentity;
const fingerprint = "fp-1" as SchemaFingerprint;
const sessionId = "session-1" as SessionId;
const origin: ToolOrigin = { id: "mcp-fs", kind: "mcp-server" };

const entry: ToolEntry = {
  identity,
  origin,
  qualifiedName: "mcp-fs:read_file" as ToolEntry["qualifiedName"],
  contract: { description: "test", inputSchema: { type: "object" } },
  schemaFingerprint: fingerprint,
  previousSchemaFingerprint: undefined,
  stale: false,
};

function allowDecision(): PolicyDecision {
  return {
    verdict: "allow",
    ruleApplied: "risk-default",
    baseRisk: "read-only",
    identity,
    schemaFingerprint: fingerprint,
  };
}

function makeDeps(
  overrides: Partial<Omit<ToolsCallDeps, "resolveExecutionClient">> & {
    executionClient?: ExecutionChannelClient;
  } = {},
): ToolsCallDeps {
  const executionClient: ExecutionChannelClient = overrides.executionClient ?? {
    connect: vi.fn(async () => undefined),
    request: vi.fn(
      async () =>
        ({
          ok: true,
          outcome: {
            kind: "executed",
            exitCode: 0,
            stdout: "ok",
            stderr: "",
            stdoutTruncated: false,
            stderrTruncated: false,
            stdoutBytes: 0,
            stderrBytes: 0,
          },
        }) as ExecutionChannelResponse,
    ),
    cancel: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  return {
    resolveToolEntry: vi.fn(async () => entry),
    evaluate: vi.fn(async () => allowDecision()),
    sendProgress: vi.fn(),
    cancelled: new AbortController().signal,
    progressIntervalMs: 20,
    ...overrides,
    // Set after the override spread so a passed-in `executionClient` (consumed above to build
    // `executionClient`) never leaks into `ToolsCallDeps`, which has no such property.
    resolveExecutionClient: () => executionClient,
  };
}

describe("handleToolCall (DEC-045)", () => {
  it("unknown tool returns an error without evaluating policy", async () => {
    const deps = makeDeps({ resolveToolEntry: vi.fn(async () => undefined) });
    const result = await handleToolCall("nope", {}, "host-1", sessionId, deps);
    expect(result.isError).toBe(true);
    expect(deps.evaluate).not.toHaveBeenCalled();
  });

  it("successful call returns the execution outcome", async () => {
    const deps = makeDeps();
    const result = await handleToolCall(
      "mcp-fs:read_file",
      { path: "/a" },
      "host-1",
      sessionId,
      deps,
    );
    expect(result.isError).toBe(false);
  });

  it("emits progress periodically while waiting on Execution", async () => {
    let resolveRequest!: (r: ExecutionChannelResponse) => void;
    const pending = new Promise<ExecutionChannelResponse>((resolve) => {
      resolveRequest = resolve;
    });
    const deps = makeDeps({
      executionClient: {
        connect: vi.fn(async () => undefined),
        request: vi.fn(() => pending),
        cancel: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
      },
      progressIntervalMs: 5,
    });

    const callPromise = handleToolCall("mcp-fs:read_file", {}, "host-1", sessionId, deps);
    await new Promise((r) => setTimeout(r, 30));
    expect(vi.mocked(deps.sendProgress)).toHaveBeenCalled();

    resolveRequest({
      ok: true,
      outcome: {
        kind: "executed",
        exitCode: 0,
        stdout: "",
        stderr: "",
        stdoutTruncated: false,
        stderrTruncated: false,
        stdoutBytes: 0,
        stderrBytes: 0,
      },
    });
    await callPromise;
  });

  it("stops emitting progress once the call resolves", async () => {
    const deps = makeDeps({ progressIntervalMs: 5 });
    await handleToolCall("mcp-fs:read_file", {}, "host-1", sessionId, deps);
    const callsAtCompletion = vi.mocked(deps.sendProgress).mock.calls.length;
    await new Promise((r) => setTimeout(r, 30));
    expect(vi.mocked(deps.sendProgress).mock.calls.length).toBe(callsAtCompletion);
  });

  it("cancellation before Execution responds propagates cancel() and returns immediately", async () => {
    const controller = new AbortController();
    let requestResolved = false;
    const executionClient: ExecutionChannelClient = {
      connect: vi.fn(async () => undefined),
      request: vi.fn(async (): Promise<ExecutionChannelResponse> => {
        await new Promise((r) => setTimeout(r, 200));
        requestResolved = true;
        return {
          ok: true,
          outcome: {
            kind: "executed",
            exitCode: 0,
            stdout: "",
            stderr: "",
            stdoutTruncated: false,
            stderrTruncated: false,
            stdoutBytes: 0,
            stderrBytes: 0,
          },
        };
      }),
      cancel: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    const deps = makeDeps({ cancelled: controller.signal, executionClient });

    const callPromise = handleToolCall("mcp-fs:read_file", {}, "host-1", sessionId, deps);
    controller.abort();
    const result = await callPromise;

    expect(result).toEqual({ isError: true, content: "Cancelled" });
    expect(requestResolved).toBe(false); // handleToolCall did not wait for the slow request
    expect(vi.mocked(executionClient.cancel)).toHaveBeenCalledWith(
      identity,
      "host-1",
      {},
      fingerprint,
      sessionId,
      expect.any(String),
    );
  });

  it("already-cancelled signal short-circuits without ever calling request", async () => {
    const controller = new AbortController();
    controller.abort();
    const deps = makeDeps({ cancelled: controller.signal });

    const result = await handleToolCall("mcp-fs:read_file", {}, "host-1", sessionId, deps);
    expect(result).toEqual({ isError: true, content: "Cancelled" });
  });

  it("a failed IPC response (Execution unreachable) is surfaced as an error, never silently allowed", async () => {
    const deps = makeDeps({
      executionClient: {
        connect: vi.fn(async () => undefined),
        request: vi.fn(
          async () =>
            ({ ok: false, reason: "Not connected to Execution" }) as ExecutionChannelResponse,
        ),
        cancel: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
      },
    });

    const result = await handleToolCall("mcp-fs:read_file", {}, "host-1", sessionId, deps);
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Not connected");
  });

  it("never forwards free-form text: parameters pass through unmodified to the ExecutionChannelRequest", async () => {
    let captured: ExecutionChannelRequest | undefined;
    const deps = makeDeps({
      executionClient: {
        connect: vi.fn(async () => undefined),
        request: vi.fn(async (req: ExecutionChannelRequest): Promise<ExecutionChannelResponse> => {
          captured = req;
          return {
            ok: true,
            outcome: {
              kind: "executed",
              exitCode: 0,
              stdout: "",
              stderr: "",
              stdoutTruncated: false,
              stderrTruncated: false,
              stdoutBytes: 0,
              stderrBytes: 0,
            },
          };
        }),
        cancel: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
      },
    });

    await handleToolCall("mcp-fs:read_file", { path: "/a; rm -rf /" }, "host-1", sessionId, deps);
    expect(captured?.parameters.path).toBe("/a; rm -rf /"); // preserved, not shell-interpreted here
    expect(captured?.identity).toBe(identity);
  });

  it("DEC-049: sessionId is propagated to Execution purely as correlation metadata", async () => {
    let captured: ExecutionChannelRequest | undefined;
    const deps = makeDeps({
      executionClient: {
        connect: vi.fn(async () => undefined),
        request: vi.fn(async (req: ExecutionChannelRequest): Promise<ExecutionChannelResponse> => {
          captured = req;
          return {
            ok: true,
            outcome: {
              kind: "executed",
              exitCode: 0,
              stdout: "",
              stderr: "",
              stdoutTruncated: false,
              stderrTruncated: false,
              stdoutBytes: 0,
              stderrBytes: 0,
            },
          };
        }),
        cancel: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
      },
    });

    await handleToolCall("mcp-fs:read_file", { path: "/a" }, "host-1", sessionId, deps);
    expect(captured?.sessionId).toBe(sessionId);
  });
});

describe("handleToolCall: Execution Backend routing by origin.id (Fase 11, DEC-058)", () => {
  const githubEntry: ToolEntry = {
    ...entry,
    identity: "tool-github" as ToolIdentity,
    origin: { id: "connector-github", kind: "agentforge" },
    qualifiedName: "connector-github:create_issue" as ToolEntry["qualifiedName"],
  };

  it("resolveExecutionClient is called with the resolved entry's origin.id, not a fixed value", async () => {
    const seenOriginIds: string[] = [];
    const executionClient: ExecutionChannelClient = {
      connect: vi.fn(async () => undefined),
      request: vi.fn(
        async () =>
          ({
            ok: true,
            outcome: {
              kind: "executed",
              exitCode: 0,
              stdout: "",
              stderr: "",
              stdoutTruncated: false,
              stderrTruncated: false,
              stdoutBytes: 0,
              stderrBytes: 0,
            },
          }) as ExecutionChannelResponse,
      ),
      cancel: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    const deps: ToolsCallDeps = {
      resolveToolEntry: vi.fn(async () => githubEntry),
      evaluate: vi.fn(async () => allowDecision()),
      resolveExecutionClient: (originId: string) => {
        seenOriginIds.push(originId);
        return executionClient;
      },
      sendProgress: vi.fn(),
      cancelled: new AbortController().signal,
      progressIntervalMs: 20,
    };

    await handleToolCall("connector-github:create_issue", {}, "account-1", sessionId, deps);
    expect(seenOriginIds).toEqual(["connector-github"]);
  });

  it("no Execution Backend configured for the origin: fails closed without ever calling request/cancel", async () => {
    const request = vi.fn();
    const cancel = vi.fn();
    const unreachableClient: ExecutionChannelClient = {
      connect: vi.fn(async () => undefined),
      request,
      cancel,
      close: vi.fn(async () => undefined),
    };
    const deps: ToolsCallDeps = {
      resolveToolEntry: vi.fn(async () => githubEntry),
      evaluate: vi.fn(async () => allowDecision()),
      // Only "execution-ssh" is configured — "connector-github" has no backend registered.
      resolveExecutionClient: (originId: string) =>
        originId === "execution-ssh" ? unreachableClient : undefined,
      sendProgress: vi.fn(),
      cancelled: new AbortController().signal,
      progressIntervalMs: 20,
    };

    const result = await handleToolCall(
      "connector-github:create_issue",
      {},
      "account-1",
      sessionId,
      deps,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toContain("connector-github");
    expect(request).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("no Execution Backend configured: writes execution-completed(execution-unavailable) to the audit log", async () => {
    const events: Array<{ type: string }> = [];
    const recordingAuditWriter = { write: async (e: { type: string }) => void events.push(e) };
    const deps: ToolsCallDeps = {
      resolveToolEntry: vi.fn(async () => githubEntry),
      evaluate: vi.fn(async () => allowDecision()),
      resolveExecutionClient: () => undefined,
      sendProgress: vi.fn(),
      cancelled: new AbortController().signal,
      progressIntervalMs: 20,
      auditWriter: recordingAuditWriter as unknown as NonNullable<ToolsCallDeps["auditWriter"]>,
    };

    await handleToolCall("connector-github:create_issue", {}, "account-1", sessionId, deps);

    const completed = events.find((e) => e.type === "execution-completed");
    expect(completed).toMatchObject({ outcomeKind: "execution-unavailable" });
  });
});
