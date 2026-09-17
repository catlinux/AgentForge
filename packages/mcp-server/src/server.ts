import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type {
  DiscoveredToolView,
  ExecutionChannelClient,
  PolicyDecision,
  ToolEntry,
} from "@agentforge/shared";
import { toMcpToolDescriptors } from "./tools-list.js";
import { handleToolCall } from "./tools-call.js";

export interface McpServerDeps {
  readonly discover: () => Promise<readonly DiscoveredToolView[]>;
  readonly resolveToolEntry: (mcpToolName: string) => Promise<ToolEntry | undefined>;
  readonly evaluate: (entry: ToolEntry) => Promise<PolicyDecision>;
  readonly executionClient: ExecutionChannelClient;
  readonly resolveHostId: (args: Readonly<Record<string, unknown>>) => string;
  readonly progressIntervalMs: number;
}

/**
 * Builds and returns the AgentForge MCP server (DEC-043, DEC-044). Uses the low-level `Server`
 * (not `McpServer`) so `tools/list` can expose Discovery's JSON Schema (DEC-013/DEC-020) directly,
 * without a Zod-shape conversion layer that isn't needed for this phase's scope.
 *
 * DEC-046: stdio transport only — this module never writes anything to stdout except what the
 * SDK's StdioServerTransport itself writes as MCP protocol frames.
 */
export function createMcpServer(deps: McpServerDeps): Server {
  const server = new Server(
    { name: "agentforge", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const views = await deps.discover();
    return { tools: toMcpToolDescriptors(views) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const hostId = deps.resolveHostId(args);
    const stringArgs: Record<string, string> = {};
    for (const [key, value] of Object.entries(args)) {
      if (key === "hostId") continue;
      stringArgs[key] = String(value);
    }

    const result = await handleToolCall(request.params.name, stringArgs, hostId, {
      resolveToolEntry: deps.resolveToolEntry,
      evaluate: deps.evaluate,
      executionClient: deps.executionClient,
      sendProgress: () => {
        void extra.sendNotification({
          method: "notifications/progress",
          params: {
            progressToken: extra.requestId,
            progress: Date.now(),
          },
        });
      },
      cancelled: extra.signal,
      progressIntervalMs: deps.progressIntervalMs,
    });

    return {
      isError: result.isError,
      content: [{ type: "text", text: result.content }],
    };
  });

  return server;
}

export async function startStdioServer(deps: McpServerDeps): Promise<void> {
  const server = createMcpServer(deps);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
