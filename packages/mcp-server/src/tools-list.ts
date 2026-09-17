import type { DiscoveredToolView } from "@agentforge/shared";

/** MCP `tools/list` tool descriptor shape (DEC-013/DEC-020: translated at the boundary only). */
export interface McpToolDescriptor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

/**
 * Translates Discovery's output (Fase 4) to MCP's `tools/list` format. Never re-implements
 * discovery — only translates the already-decided subset. `qualifiedName` becomes the MCP tool
 * `name` (a legible identifier); no internal `identity`/`schemaFingerprint` is exposed (DEC-020).
 */
export function toMcpToolDescriptors(views: readonly DiscoveredToolView[]): McpToolDescriptor[] {
  return views.map((view) => ({
    name: view.qualifiedName,
    description: view.description,
    inputSchema: view.inputSchema,
  }));
}
