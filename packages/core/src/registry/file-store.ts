import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolEntry, ToolIdentity, ToolOrigin, QualifiedName } from "@agentforge/shared";
import type { ToolRegistryStore } from "./store.js";

/**
 * File-backed ToolRegistryStore (DEC-014). Persists the discovered-tool cache as JSON. This is
 * explicitly a cache of the last known discovery result, not the source of truth for MCP-origin
 * tools — the source of truth for those is always the origin server itself, re-queried at
 * discovery time. Declarative origin configuration (which servers/hooks to connect) is a
 * separate, human-edited file, not written by this store.
 */
export class FileToolRegistryStore implements ToolRegistryStore {
  constructor(private readonly cacheFilePath: string) {}

  async list(): Promise<readonly ToolEntry[]> {
    return this.readCache();
  }

  async getByIdentity(identity: ToolIdentity): Promise<ToolEntry | undefined> {
    const entries = await this.readCache();
    return entries.find((entry) => entry.identity === identity);
  }

  async findByOriginAndName(
    originId: ToolOrigin["id"],
    qualifiedName: QualifiedName,
  ): Promise<ToolEntry | undefined> {
    const entries = await this.readCache();
    return entries.find(
      (entry) => entry.origin.id === originId && entry.qualifiedName === qualifiedName,
    );
  }

  async upsert(entry: ToolEntry): Promise<void> {
    const entries = await this.readCache();
    const index = entries.findIndex((existing) => existing.identity === entry.identity);
    const next = [...entries];
    if (index === -1) {
      next.push(entry);
    } else {
      next[index] = entry;
    }
    await this.writeCache(next);
  }

  async markStaleExcept(
    originId: ToolOrigin["id"],
    seenIdentities: readonly ToolIdentity[],
  ): Promise<void> {
    const entries = await this.readCache();
    const seen = new Set(seenIdentities);
    const next = entries.map((entry) =>
      entry.origin.id === originId && !seen.has(entry.identity) ? { ...entry, stale: true } : entry,
    );
    await this.writeCache(next);
  }

  private async readCache(): Promise<ToolEntry[]> {
    try {
      const raw = await readFile(this.cacheFilePath, "utf-8");
      return JSON.parse(raw) as ToolEntry[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async writeCache(entries: readonly ToolEntry[]): Promise<void> {
    await mkdir(dirname(this.cacheFilePath), { recursive: true });
    await writeFile(this.cacheFilePath, JSON.stringify(entries, null, 2), "utf-8");
  }
}
