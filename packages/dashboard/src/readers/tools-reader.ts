import type { ToolEntry } from "@agentforge/shared";
import { resolveRegistryCachePath } from "@agentforge/shared";
import { FileToolRegistryStore } from "@agentforge/core";

/**
 * Reads the Tool Registry's cache (DEC-014) via the same `FileToolRegistryStore` Core itself uses
 * (DEC-064) — the Dashboard never reimplements cache parsing, and never mutates it (this function
 * only calls `list()`).
 */
export async function readToolRegistry(): Promise<readonly ToolEntry[]> {
  const store = new FileToolRegistryStore(resolveRegistryCachePath());
  return store.list();
}
