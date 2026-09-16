import type { ToolEntry } from "@agentforge/shared";

/**
 * Reduction strategy contract (DEC-018). Only a static-by-configuration strategy is implemented
 * in this phase; this interface exists so usage/history-based or semantic-relevance strategies
 * can be added later as additional implementations, without redesigning callers. Discovery itself
 * always applies the `stale` exclusion (DEC-021) before invoking a strategy — a strategy never
 * needs to reimplement that.
 */
export interface DiscoveryStrategy {
  /** Reduces a candidate set of non-stale entries to the subset that should be exposed. */
  select(candidates: readonly ToolEntry[]): readonly ToolEntry[];
}
