import { createHash } from "node:crypto";
import type { SchemaFingerprint, ToolIdentity } from "@agentforge/shared";

/**
 * Deterministic operation hash (DEC-038, guarantee 1): binds a confirmation to the exact tuple
 * of (identity, parameters, host, schemaFingerprint). Any change to any of these — including a
 * different parameter value for the same tool, or the same tool against a different host —
 * produces a different hash, so a prior confirmation can never apply to a different operation.
 * Same normalization technique as `computeSchemaFingerprint` (Fase 3): recursively sort object
 * keys before hashing, so key order never affects the result.
 */
export type OperationHash = string & { readonly __brand: "OperationHash" };

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = normalize((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

export function computeOperationHash(
  identity: ToolIdentity,
  parameters: Readonly<Record<string, string>>,
  hostId: string,
  schemaFingerprint: SchemaFingerprint,
): OperationHash {
  const normalized = JSON.stringify(normalize({ identity, parameters, hostId, schemaFingerprint }));
  return createHash("sha256").update(normalized).digest("hex") as OperationHash;
}
