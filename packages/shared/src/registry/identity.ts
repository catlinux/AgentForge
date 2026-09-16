/**
 * Tool identity concepts (DEC-016). Three distinct things, never conflated:
 *
 * - `ToolIdentity`  — internal, opaque, stable. Generated and controlled exclusively by
 *   AgentForge, never by the origin (an MCP server cannot propose its own identity). This is the
 *   Registry's primary key.
 * - `QualifiedName`  — `origin:name`, human-readable. A mutable attribute of a `ToolIdentity`,
 *   never used as a lookup key on its own.
 * - `SchemaFingerprint` — deterministic hash of the observed tool contract (input schema and any
 *   other contract-relevant fields). Identifies a *version* of the contract, not the tool itself.
 *
 * Resolution rule (DEC-016): whether a discovered tool is "the same" as a previously known one is
 * decided by (configured origin + reported name) at discovery time — never by name similarity
 * across different origins, and never retroactively/heuristically. A name not seen before under a
 * known origin, or a different physical server behind the same configured origin, produces a new
 * candidate `ToolIdentity` by default. Merging two identities (recognizing a genuine rename)
 * requires an explicit declarative action by the user — never an automatic Registry decision.
 */

/** Opaque, stable, internal identifier. Never parsed for meaning — treat as an opaque string. */
export type ToolIdentity = string & { readonly __brand: "ToolIdentity" };

/** `origin:name` — human-readable, mutable, never a lookup key. */
export type QualifiedName = string & { readonly __brand: "QualifiedName" };

/** Deterministic hash of an observed tool contract. */
export type SchemaFingerprint = string & { readonly __brand: "SchemaFingerprint" };

export function toQualifiedName(originId: string, reportedName: string): QualifiedName {
  return `${originId}:${reportedName}` as QualifiedName;
}
