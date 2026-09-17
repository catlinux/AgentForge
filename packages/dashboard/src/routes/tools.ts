import type { FastifyInstance } from "fastify";
import { readToolRegistry } from "../readers/tools-reader.js";
import { readDiscoveredTools } from "../readers/discovery-reader.js";

/** Read-only routes: GET only (DEC-064). */
export function registerToolsRoutes(app: FastifyInstance): void {
  app.get("/api/tools/registry", async () => {
    const entries = await readToolRegistry();
    return { entries };
  });

  app.get("/api/tools/discovery", async () => {
    const views = await readDiscoveredTools();
    return { views };
  });
}
