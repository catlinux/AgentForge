import type { FastifyInstance } from "fastify";
import { startDashboard } from "./server.js";

const DEFAULT_PORT = 4173;

function resolvePort(): number {
  const raw = process.env["AGENTFORGE_DASHBOARD_PORT"];
  if (raw === undefined) {
    return DEFAULT_PORT;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

/**
 * Minimal real entrypoint for the Dashboard process (DEC-064 to DEC-069, Fase 12). Same pattern
 * as the Fase 16 entrypoints: reuses `startDashboard(port)` exactly as it already exists, adding
 * only environment-variable-driven port selection — no new server logic, no new routes. Bind
 * stays exclusively `127.0.0.1` inside `startDashboard` itself (DEC-068), unaffected by this file.
 */
async function main(): Promise<FastifyInstance> {
  return startDashboard(resolvePort());
}

main().catch((error: unknown) => {
  console.error("agentforge-dashboard failed to start:", error);
  process.exitCode = 1;
});
