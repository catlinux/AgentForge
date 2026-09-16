import { randomUUID } from "node:crypto";
import {
  computeSchemaFingerprint,
  toQualifiedName,
  type ToolContract,
  type ToolEntry,
  type ToolIdentity,
  type ToolOrigin,
} from "@agentforge/shared";
import type { ToolRegistryStore } from "./store.js";

export interface DiscoveredTool {
  readonly reportedName: string;
  readonly contract: ToolContract;
}

export type ResolutionOutcome =
  | { readonly kind: "known"; readonly entry: ToolEntry; readonly schemaChanged: boolean }
  | { readonly kind: "new"; readonly entry: ToolEntry };

/**
 * Resolves a single discovered tool against the store, applying the DEC-016 rules:
 *
 * - Matching is by (configured origin + reported name) only — never by name similarity across
 *   origins, never retroactively.
 * - A name not previously seen under this origin always produces a NEW identity. It never
 *   inherits an existing identity or its approval, even if the name resembles a known one.
 * - `identity` is generated here, by AgentForge, as a random UUID — never derived from anything
 *   the origin reports, so a compromised origin cannot influence which identity it gets.
 * - If a known entry's contract fingerprint differs from what was last observed, that is surfaced
 *   as `schemaChanged: true` rather than silently absorbed — Policy Engine (Phase 5) decides what
 *   to do with that fact. It never triggers a new identity by itself.
 *
 * Merging two identities (recognizing a genuine rename) is deliberately NOT implemented here —
 * DEC-016 requires that to be an explicit declarative action by the user, not an automatic
 * Registry decision.
 */
export async function resolveDiscoveredTool(
  store: ToolRegistryStore,
  origin: ToolOrigin,
  discovered: DiscoveredTool,
): Promise<ResolutionOutcome> {
  const qualifiedName = toQualifiedName(origin.id, discovered.reportedName);
  const fingerprint = computeSchemaFingerprint(discovered.contract);

  const existing = await store.findByOriginAndName(origin.id, qualifiedName);

  if (existing === undefined) {
    const entry: ToolEntry = {
      identity: randomUUID() as ToolIdentity,
      origin,
      qualifiedName,
      contract: discovered.contract,
      schemaFingerprint: fingerprint,
      previousSchemaFingerprint: undefined,
      stale: false,
    };
    return { kind: "new", entry };
  }

  const schemaChanged = existing.schemaFingerprint !== fingerprint;
  const entry: ToolEntry = {
    ...existing,
    contract: discovered.contract,
    schemaFingerprint: fingerprint,
    previousSchemaFingerprint: schemaChanged
      ? existing.schemaFingerprint
      : existing.previousSchemaFingerprint,
    stale: false,
  };
  return { kind: "known", entry, schemaChanged };
}
