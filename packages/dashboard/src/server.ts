import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerToolsRoutes } from "./routes/tools.js";
import { registerPolicyRoutes } from "./routes/policy.js";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "public");

const STATIC_CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

/**
 * Builds the Dashboard's Fastify app (DEC-066): read-only HTTP API (GET only, DEC-064) over
 * Tool Registry/Discovery, Policy Engine configuration, and Audit Log, plus the static HTML/JS
 * frontend (DEC-067, no build toolchain). Never exposes secrets, never triggers execution.
 */
export function createDashboardApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  registerAuditRoutes(app);
  registerToolsRoutes(app);
  registerPolicyRoutes(app);

  app.get("/", async (_request, reply) => serveStaticFile(reply, "index.html"));
  app.get("/app.js", async (_request, reply) => serveStaticFile(reply, "app.js"));
  app.get("/style.css", async (_request, reply) => serveStaticFile(reply, "style.css"));

  return app;
}

async function serveStaticFile(reply: FastifyReply, fileName: string): Promise<unknown> {
  const extension = fileName.slice(fileName.lastIndexOf("."));
  const contentType = STATIC_CONTENT_TYPES[extension] ?? "application/octet-stream";
  const content = await readFile(join(publicDir, fileName), "utf-8");
  return reply.type(contentType).send(content);
}

/**
 * Starts the Dashboard HTTP server bound exclusively to loopback (DEC-068) — never `0.0.0.0`,
 * documented explicitly as a limitation of this phase, not a permanent constraint.
 */
export async function startDashboard(port: number): Promise<FastifyInstance> {
  const app = createDashboardApp();
  await app.listen({ port, host: "127.0.0.1" });
  return app;
}
