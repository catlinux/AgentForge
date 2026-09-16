import { createHash } from "node:crypto";
import type { SchemaFingerprint } from "./identity.js";

/**
 * Deterministically normalizes a JSON-like value by recursively sorting object keys, so that
 * two structurally-equal schemas always serialize identically regardless of key order.
 */
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

/**
 * Computes the SchemaFingerprint (DEC-016) of an observed tool contract. Deterministic: the same
 * contract, regardless of key order, always produces the same fingerprint.
 */
export function computeSchemaFingerprint(contract: unknown): SchemaFingerprint {
  const normalized = JSON.stringify(normalize(contract));
  const hash = createHash("sha256").update(normalized).digest("hex");
  return hash as SchemaFingerprint;
}
