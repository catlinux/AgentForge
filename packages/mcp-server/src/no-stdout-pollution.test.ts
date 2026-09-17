import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

async function listTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...(await listTsFiles(join(dir, entry.name))));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

/**
 * DEC-046: the MCP server must never write anything but MCP protocol frames to stdout — its
 * own stdin/stdout is exclusively owned by StdioServerTransport (the SDK). This test statically
 * verifies no source file in this package writes to `console.*`, `process.stdout`, or
 * `process.stdin` directly (the only such usage in the whole project — `readline-channel.ts` —
 * lives in the separate `execution-ssh` package/process, per DEC-047, never here).
 */
describe("mcp-server package never touches stdin/stdout directly (DEC-046)", () => {
  it("no console.* calls in any source file", async () => {
    const files = await listTsFiles(here);
    for (const file of files) {
      const content = await readFile(file, "utf-8");
      expect(content, `${file} must not call console.*`).not.toMatch(/console\.\w+\(/);
    }
  });

  it("no direct process.stdout / process.stdin usage in any source file", async () => {
    const files = await listTsFiles(here);
    for (const file of files) {
      const content = await readFile(file, "utf-8");
      expect(content, `${file} must not touch process.stdout directly`).not.toMatch(
        /process\.stdout/,
      );
      expect(content, `${file} must not touch process.stdin directly`).not.toMatch(
        /process\.stdin/,
      );
    }
  });
});
