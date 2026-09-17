import { describe, expect, it, vi } from "vitest";
import type {
  ExecutionChannelClient,
  ExecutionChannelRequest,
  ExecutionChannelResponse,
  PolicyDecision,
  SchemaFingerprint,
  ToolEntry,
  ToolIdentity,
  ToolOrigin,
} from "@agentforge/shared";
import { handleToolCall, type ToolsCallDeps } from "./tools-call.js";

const identity = "tool-1" as ToolIdentity;
const fingerprint = "fp-1" as SchemaFingerprint;
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

function makeDeps(overrides: Partial<ToolsCallDeps> = {}): ToolsCallDeps {
  const executionClient: ExecutionChannelClient = {
    connect: vi.fn(async () => undefined),
    request: vi.fn(
      async () =>
        ({
          ok: true,
          outcome: { kind: "executed", exitCode: 0, stdout: "ok", stderr: "" },
        }) as ExecutionChannelResponse,
    ),
    cancel: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  return {
    resolveToolEntry: vi.fn(async () => entry),
    evaluate: vi.fn(async () => allowDecision()),
    executionClient,
    sendProgress: vi.fn(),
    cancelled: new AbortController().signal,
    progressIntervalMs: 20,
    ...overrides,
  };
}

describe("handleToolCall (DEC-045)", () => {
  it("unknown tool returns an error without evaluating policy", async () => {
    const deps = makeDeps({ resolveToolEntry: vi.fn(async () => undefined) });
    const result = await handleToolCall("nope", {}, "host-1", deps);
    expect(result.isError).toBe(true);
    expect(deps.evaluate).not.toHaveBeenCalled();
  });

  it("successful call returns the execution outcome", async () => {
    const deps = makeDeps();
    const result = await handleToolCall("mcp-fs:read_file", { path: "/a" }, "host-1", deps);
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

    const callPromise = handleToolCall("mcp-fs:read_file", {}, "host-1", deps);
    await new Promise((r) => setTimeout(r, 30));
    expect(vi.mocked(deps.sendProgress)).toHaveBeenCalled();

    resolveRequest({
      ok: true,
      outcome: { kind: "executed", exitCode: 0, stdout: "", stderr: "" },
    });
    await callPromise;
  });

  it("stops emitting progress once the call resolves", async () => {
    const deps = makeDeps({ progressIntervalMs: 5 });
    await handleToolCall("mcp-fs:read_file", {}, "host-1", deps);
    const callsAtCompletion = vi.mocked(deps.sendProgress).mock.calls.length;
    await new Promise((r) => setTimeout(r, 30));
    expect(vi.mocked(deps.sendProgress).mock.calls.length).toBe(callsAtCompletion);
  });

  it("cancellation before Execution responds propagates cancel() and returns immediately", async () => {
    const controller = new AbortController();
    let requestResolved = false;
    const deps = makeDeps({
      cancelled: controller.signal,
      executionClient: {
        connect: vi.fn(async () => undefined),
        request: vi.fn(async (): Promise<ExecutionChannelResponse> => {
          await new Promise((r) => setTimeout(r, 200));
          requestResolved = true;
          return { ok: true, outcome: { kind: "executed", exitCode: 0, stdout: "", stderr: "" } };
        }),
        cancel: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
      },
    });

    const callPromise = handleToolCall("mcp-fs:read_file", {}, "host-1", deps);
    controller.abort();
    const result = await callPromise;

    expect(result).toEqual({ isError: true, content: "Cancelled" });
    expect(requestResolved).toBe(false); // handleToolCall did not wait for the slow request
    expect(vi.mocked(deps.executionClient.cancel)).toHaveBeenCalledWith(
      identity,
      "host-1",
      {},
      fingerprint,
    );
  });

  it("already-cancelled signal short-circuits without ever calling request", async () => {
    const controller = new AbortController();
    controller.abort();
    const deps = makeDeps({ cancelled: controller.signal });

    const result = await handleToolCall("mcp-fs:read_file", {}, "host-1", deps);
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

    const result = await handleToolCall("mcp-fs:read_file", {}, "host-1", deps);
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
          return { ok: true, outcome: { kind: "executed", exitCode: 0, stdout: "", stderr: "" } };
        }),
        cancel: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
      },
    });

    await handleToolCall("mcp-fs:read_file", { path: "/a; rm -rf /" }, "host-1", deps);
    expect(captured?.parameters.path).toBe("/a; rm -rf /"); // preserved, not shell-interpreted here
    expect(captured?.identity).toBe(identity);
  });
});
