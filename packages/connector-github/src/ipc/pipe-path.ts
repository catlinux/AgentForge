import { platform } from "node:os";
import { join } from "node:path";

/**
 * Fixed channel name for the MCP-server <-> GitHub connector IPC channel (DEC-047 pattern,
 * DEC-058). Distinct from `execution-ssh`'s channel name so both Execution Backend processes can
 * run simultaneously without colliding — the MCP server holds one `ExecutionChannelClient` per
 * backend, keyed by `ToolEntry.origin.id` (Fase 11, Parte 3 of the plan).
 */
export function connectorChannelPath(): string {
  if (platform() === "win32") {
    return "\\\\.\\pipe\\agentforge-connector-github";
  }
  return join("/tmp", "agentforge-connector-github.sock");
}
