import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { startDashboard } from "./server.js";

describe("startDashboard via the real port-resolution env var (Fase 16 pattern)", () => {
  let dataDir: string;
  let originalDataDir: string | undefined;
  let app: FastifyInstance | undefined;

  beforeEach(async () => {
    originalDataDir = process.env["AGENTFORGE_DATA_DIR"];
    dataDir = await mkdtemp(join(tmpdir(), "agentforge-dashboard-main-test-"));
    process.env["AGENTFORGE_DATA_DIR"] = dataDir;
  });

  afterEach(async () => {
    if (originalDataDir === undefined) delete process.env["AGENTFORGE_DATA_DIR"];
    else process.env["AGENTFORGE_DATA_DIR"] = originalDataDir;
    await app?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("starts the real Fastify app bound to 127.0.0.1 on an explicit port", async () => {
    app = await startDashboard(0);
    const address = app.server.address();
    expect(address).not.toBeNull();
    if (address !== null && typeof address === "object") {
      expect(address.address).toBe("127.0.0.1");
    }
  });
});
