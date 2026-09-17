import type { FastifyInstance } from "fastify";
import { readPolicyConfig } from "../readers/policy-reader.js";

/** Read-only route: GET only (DEC-064). Never exposes secrets — this is only risk/override
 * classification by `identity` (DEC-023/DEC-024), never secret material. */
export function registerPolicyRoutes(app: FastifyInstance): void {
  app.get("/api/policy", async () => {
    const config = await readPolicyConfig();
    return config;
  });
}
