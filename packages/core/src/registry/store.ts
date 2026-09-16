import type { ToolEntry, ToolIdentity, ToolOrigin, QualifiedName } from "@agentforge/shared";

/**
 * Access interface for the Tool Registry's persisted state (DEC-014). Callers never read config
 * or cache files directly — everything goes through this interface, so a future storage change
 * (e.g. to SQLite, if volume ever justifies it) is bounded to implementing it here again.
 */
export interface ToolRegistryStore {
  /** All known entries, including stale ones (never silently dropped — DEC-016). */
  list(): Promise<readonly ToolEntry[]>;

  /** Looks up an entry by its stable identity. */
  getByIdentity(identity: ToolIdentity): Promise<ToolEntry | undefined>;

  /**
   * Looks up an entry by (origin, qualified name) — the resolution key used at discovery time
   * (DEC-016). Never resolves by qualified name alone across different origins.
   */
  findByOriginAndName(
    originId: ToolOrigin["id"],
    qualifiedName: QualifiedName,
  ): Promise<ToolEntry | undefined>;

  /** Persists a new or updated entry. */
  upsert(entry: ToolEntry): Promise<void>;

  /** Marks entries for the given origin not present in `seenIdentities` as stale (DEC-016). */
  markStaleExcept(
    originId: ToolOrigin["id"],
    seenIdentities: readonly ToolIdentity[],
  ): Promise<void>;
}
