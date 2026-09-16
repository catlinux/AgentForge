import type { QualifiedName, SchemaFingerprint, ToolIdentity } from "./identity.js";

/**
 * AgentForge's own tool contract model (DEC-013). MCP-compatible, not MCP-native: `inputSchema`
 * reuses JSON Schema (a standard in its own right, not MCP-proprietary), but this type is never
 * MCP's `tools/list` shape directly — a dedicated adapter (Phase 8) translates to/from MCP at the
 * integration boundary. This lets non-MCP origins (AgentForge's own hooks, future execution
 * backends) populate the same model without pretending to be MCP.
 */
export interface ToolContract {
  /** JSON Schema describing the tool's input parameters. */
  readonly inputSchema: Record<string, unknown>;
  /** Human-readable description of what the tool does. */
  readonly description: string;
}

/** Where a tool's existence and shape are declared or discovered from (DEC-014, DEC-015). */
export type ToolOriginKind = "agentforge" | "mcp-server";

/** A configured source the Registry knows about — declarative, not discovered (DEC-014). */
export interface ToolOrigin {
  /** Stable identifier for this configured origin (e.g. a connection/config entry id). */
  readonly id: string;
  readonly kind: ToolOriginKind;
}

/**
 * A single registered tool entry (DEC-016). `identity` is the primary key; `qualifiedName` and
 * `schemaFingerprint` are mutable attributes tracked over time, never used for lookup on their
 * own.
 */
export interface ToolEntry {
  readonly identity: ToolIdentity;
  readonly origin: ToolOrigin;
  readonly qualifiedName: QualifiedName;
  readonly contract: ToolContract;
  readonly schemaFingerprint: SchemaFingerprint;
  /** Previous fingerprint, if the contract has changed since this entry was first registered. */
  readonly previousSchemaFingerprint: SchemaFingerprint | undefined;
  /**
   * Whether this entry was seen in the most recent discovery cycle for its origin. An entry not
   * seen is kept (never deleted, for audit traceability — DEC-016) but marked stale.
   */
  readonly stale: boolean;
}
