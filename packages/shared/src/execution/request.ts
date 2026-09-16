import type { ToolIdentity } from "../registry/identity.js";

/** A resolved execution request (Fase 7). Parameters are already validated against the tool's
 * `inputSchema` (DEC-013) before reaching Execution — Execution never receives free-form text. */
export interface ExecutionRequest {
  readonly identity: ToolIdentity;
  readonly hostId: string;
  readonly parameters: Readonly<Record<string, string>>;
}
