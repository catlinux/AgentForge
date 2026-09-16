import type { QualifiedName } from "../registry/identity.js";

/**
 * Reduced projection of a tool exposed by Tool Discovery (DEC-020). Deliberately not `ToolEntry`
 * and not MCP's `tools/list` shape: the agent is a potentially untrusted component (DEC-003) and
 * should never see internal Registry bookkeeping (`identity`, `schemaFingerprint`), and coupling
 * this shape to MCP would repeat the mistake DEC-013 avoided for the Registry's own model. A
 * future MCP adapter (Phase 8) translates this into the MCP format, not the other way around.
 */
export interface DiscoveredToolView {
  readonly qualifiedName: QualifiedName;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}
