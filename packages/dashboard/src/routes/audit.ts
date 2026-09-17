import type { FastifyInstance } from "fastify";
import { readAllAuditLogs } from "../readers/audit-reader.js";

/** Read-only route: GET only (DEC-064 — the Dashboard never mutates anything). */
export function registerAuditRoutes(app: FastifyInstance): void {
  app.get("/api/audit", async () => {
    const events = await readAllAuditLogs();
    return { events };
  });
}
