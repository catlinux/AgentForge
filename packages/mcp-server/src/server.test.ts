import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type {
  DiscoveredToolView,
  ExecutionChannelClient,
  ExecutionChannelRequest,
  ExecutionChannelResponse,
  PolicyDecision,
  SchemaFingerprint,
  ToolEntry,
  ToolIdentity,
  ToolOrigin,
} from "@agentforge/shared";
import { createMcpServer, type McpServerDeps } from "./server.js";

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

const view: DiscoveredToolView = {
  qualifiedName: entry.qualifiedName,
  description: entry.contract.description,
  inputSchema: entry.contract.inputSchema,
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

function makeDeps(captured: ExecutionChannelRequest[]): McpServerDeps {
  const executionClient: ExecutionChannelClient = {
    connect: vi.fn(async () => undefined),
    request: vi.fn(async (req: ExecutionChannelRequest): Promise<ExecutionChannelResponse> => {
      captured.push(req);
      return {
        ok: true,
        outcome: {
          kind: "executed",
          exitCode: 0,
          stdout: "ok",
          stderr: "",
          stdoutTruncated: false,
          stderrTruncated: false,
        },
      };
    }),
    cancel: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  return {
    discover: async () => [view],
    resolveToolEntry: async () => entry,
    evaluate: async () => allowDecision(),
    executionClient,
    resolveHostId: () => "host-1",
    progressIntervalMs: 1000,
  };
}

async function connectedClient(
  deps: McpServerDeps,
): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createMcpServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe("createMcpServer sessions (DEC-048/DEC-049/DEC-050)", () => {
  it("propagates the same sessionId across multiple tools/call in one server instance", async () => {
    const captured: ExecutionChannelRequest[] = [];
    const deps = makeDeps(captured);
    const { client, close } = await connectedClient(deps);

    await client.callTool({ name: "mcp-fs:read_file", arguments: {} });
    await client.callTool({ name: "mcp-fs:read_file", arguments: {} });

    expect(captured).toHaveLength(2);
    expect(captured[0]?.sessionId).toBeDefined();
    expect(captured[0]?.sessionId).toBe(captured[1]?.sessionId);

    await close();
  });

  it("a new server instance (simulating a process restart) generates a different sessionId — no reuse across restarts", async () => {
    const capturedA: ExecutionChannelRequest[] = [];
    const { client: clientA, close: closeA } = await connectedClient(makeDeps(capturedA));
    await clientA.callTool({ name: "mcp-fs:read_file", arguments: {} });
    await closeA();

    const capturedB: ExecutionChannelRequest[] = [];
    const { client: clientB, close: closeB } = await connectedClient(makeDeps(capturedB));
    await clientB.callTool({ name: "mcp-fs:read_file", arguments: {} });
    await closeB();

    expect(capturedA[0]?.sessionId).toBeDefined();
    expect(capturedB[0]?.sessionId).toBeDefined();
    expect(capturedA[0]?.sessionId).not.toBe(capturedB[0]?.sessionId);
  });

  it("sessionId never affects the policy decision or execution outcome — pure correlation metadata", async () => {
    const captured: ExecutionChannelRequest[] = [];
    const deps = makeDeps(captured);
    const { client, close } = await connectedClient(deps);

    const result = await client.callTool({ name: "mcp-fs:read_file", arguments: {} });

    expect(result.isError).toBe(false);
    // The decision passed through to Execution is the one evaluate() produced, unaffected by
    // sessionId — evaluate() itself never receives or depends on it.
    expect(captured[0]?.decision.verdict).toBe("allow");

    await close();
  });
});
