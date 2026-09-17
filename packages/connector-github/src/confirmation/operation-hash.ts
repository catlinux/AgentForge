import { createHash } from "node:crypto";
import type { SchemaFingerprint, ToolIdentity } from "@agentforge/shared";

/**
 * Deterministic operation hash (DEC-038, guarantee 1), same construction as
 * `execution-ssh/src/confirmation/operation-hash.ts` — duplicated rather than imported across
 * packages (each Execution Backend owns its own confirmation machinery, DEC-042/DEC-058; no
 * shared runtime dependency between backend packages). Binds a confirmation to the exact tuple of
 * (identity, parameters, hostId, schemaFingerprint) — for this connector, `hostId` identifies the
 * configured GitHub account, not a physical host.
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
