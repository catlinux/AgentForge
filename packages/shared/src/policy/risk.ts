/**
 * Risk classification (DEC-023): three tiers, declared explicitly by the user in the Policy
 * Engine's own configuration — never inferred, never self-declared by the origin MCP server, and
 * never stored on `ToolEntry` (DEC-013/DEC-016 remain untouched).
 *
 * Constant per `identity` in this phase (DEC-023b): when a tool's impact varies by argument, it
 * must be classified by its reasonable worst case. Modulating risk by the arguments of a
 * concrete invocation is out of scope for this phase.
 */
export type RiskLevel = "read-only" | "reversible-write" | "destructive";
