import { platform } from "node:os";
import { join } from "node:path";

/**
 * Fixed channel name for the Execution Backend <-> Secrets Broker IPC channel (Fase 13, DEC-F).
 * Same fixed-path, single-instance pattern as `executionChannelPath` (DEC-047) — no discovery, no
 * support for multiple simultaneous Secrets Broker instances in this phase, documented limitation.
 * Lives in `packages/shared` (not `packages/secrets-broker` or `packages/execution-ssh`) because
 * both the server (Broker) and every Execution Backend client need the same value.
 */
export function executionSecretsChannelPath(): string {
  if (platform() === "win32") {
    return "\\\\.\\pipe\\agentforge-secrets";
  }
  return join("/tmp", "agentforge-secrets.sock");
}
