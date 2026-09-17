import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type {
  AuditWriter,
  DiscoveredToolView,
  ExecutionChannelClient,
  PolicyDecision,
  SessionId,
  ToolEntry,
} from "@agentforge/shared";
import {
  AuditWriter as AuditWriterImpl,
  generateSessionId,
  resolveAuditLogPath,
} from "@agentforge/shared";
import { toMcpToolDescriptors } from "./tools-list.js";
import { handleToolCall } from "./tools-call.js";

export interface McpServerDeps {
  readonly discover: () => Promise<readonly DiscoveredToolView[]>;
  readonly resolveToolEntry: (mcpToolName: string) => Promise<ToolEntry | undefined>;
  readonly evaluate: (entry: ToolEntry) => Promise<PolicyDecision>;
  /** Selects which Execution Backend process handles a tool, by `ToolEntry.origin.id` (Fase 11,
   * DEC-058) — e.g. "execution-ssh", "connector-github". `undefined` means no backend is
   * configured for that origin (fail-closed, DEC-047). Still a single MCP server (DEC-043) —
   * this only routes among backend *processes*, it does not split the server itself. */
  readonly resolveExecutionClient: (originId: string) => ExecutionChannelClient | undefined;
  readonly resolveHostId: (args: Readonly<Record<string, unknown>>) => string;
  readonly progressIntervalMs: number;
  /** Optional (DEC-052/057): best-effort audit writer for this process's own events. */
  readonly auditWriter?: AuditWriter;
}

/**
 * Builds and returns the AgentForge MCP server (DEC-043, DEC-044). Uses the low-level `Server`
 * (not `McpServer`) so `tools/list` can expose Discovery's JSON Schema (DEC-013/DEC-020) directly,
 * without a Zod-shape conversion layer that isn't needed for this phase's scope.
 *
 * DEC-046: stdio transport only — this module never writes anything to stdout except what the
 * SDK's StdioServerTransport itself writes as MCP protocol frames.
 *
 * DEC-048/DEC-050: a single `SessionId` is generated once, at server construction — coherent
 * with the single-user/single-agent scope of this phase, where a session is equivalent to the
 * MCP server process's own lifetime. Not derived from the SDK's transport-level `sessionId`,
 * which `StdioServerTransport` never assigns (verified against the installed SDK).
 */
export function createMcpServer(deps: McpServerDeps): Server {
  const sessionId: SessionId = generateSessionId();

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

    const result = await handleToolCall(request.params.name, stringArgs, hostId, sessionId, {
      resolveToolEntry: deps.resolveToolEntry,
      evaluate: deps.evaluate,
      resolveExecutionClient: deps.resolveExecutionClient,
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
      ...(deps.auditWriter !== undefined ? { auditWriter: deps.auditWriter } : {}),
    });

    return {
      isError: result.isError,
      content: [{ type: "text", text: result.content }],
    };
  });

  return server;
}

/**
 * DEC-065: when the caller does not inject an `auditWriter`, defaults to a real one pointed at
 * this process's own Audit Log file (DEC-052/053), instead of silently writing no audit events at
 * all. Still best-effort/non-blocking (DEC-057) — this default changes nothing about that.
 */
export async function startStdioServer(deps: McpServerDeps): Promise<void> {
  const auditWriter = deps.auditWriter ?? new AuditWriterImpl(resolveAuditLogPath("mcp-server"));
  const server = createMcpServer({ ...deps, auditWriter });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
