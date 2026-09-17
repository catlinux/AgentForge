import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDashboardApp, startDashboard } from "./server.js";

/**
 * These tests point `AGENTFORGE_DATA_DIR` at a fresh empty temp directory so every read hits the
 * "file does not exist yet" path deterministically (DEC-064/065/069 — best-effort, tolerant
 * reads), without depending on any other package's real runtime state.
 */
describe("dashboard app (DEC-064, read-only)", () => {
  let dataDir: string;
  let originalDataDir: string | undefined;

  beforeEach(async () => {
    originalDataDir = process.env["AGENTFORGE_DATA_DIR"];
    dataDir = await mkdtemp(join(tmpdir(), "agentforge-dashboard-test-"));
    process.env["AGENTFORGE_DATA_DIR"] = dataDir;
  });

  afterEach(async () => {
    if (originalDataDir === undefined) delete process.env["AGENTFORGE_DATA_DIR"];
    else process.env["AGENTFORGE_DATA_DIR"] = originalDataDir;
    await rm(dataDir, { recursive: true, force: true });
  });

  it("GET /api/audit returns an empty list when no audit files exist yet", async () => {
    const app = createDashboardApp();
    const res = await app.inject({ method: "GET", url: "/api/audit" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ events: [] });
  });

  it("GET /api/tools/registry returns an empty list when no cache exists yet", async () => {
    const app = createDashboardApp();
    const res = await app.inject({ method: "GET", url: "/api/tools/registry" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ entries: [] });
  });

  it("GET /api/tools/discovery returns an empty list when no config exists yet", async () => {
    const app = createDashboardApp();
    const res = await app.inject({ method: "GET", url: "/api/tools/discovery" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ views: [] });
  });

  it("GET /api/policy returns empty maps when no config exists yet", async () => {
    const app = createDashboardApp();
    const res = await app.inject({ method: "GET", url: "/api/policy" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ riskByIdentity: {}, overrides: {} });
  });

  it("GET / serves the static HTML page", async () => {
    const app = createDashboardApp();
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("AgentForge Dashboard");
  });

  it("never registers a route with a method other than GET", () => {
    const app = createDashboardApp();
    const nonGetRoutes = app
      .printRoutes({ commonPrefix: false })
      .split("\n")
      .filter((line) => /\(POST|PUT|DELETE|PATCH\)/.test(line));
    expect(nonGetRoutes).toEqual([]);
  });
});

describe("startDashboard binds to loopback only (DEC-068)", () => {
  it("passes host 127.0.0.1 to Fastify's listen()", async () => {
    const app = await startDashboard(0);
    const address = app.server.address();
    expect(address && typeof address === "object" ? address.address : undefined).toBe("127.0.0.1");
    await app.close();
  });
});
