import { platform } from "node:os";
import { join } from "node:path";

/**
 * Fixed channel name for the MCP-server <-> Execution IPC channel (DEC-047). No discovery, no
 * support for multiple simultaneous instances in this phase — documented limitation.
 */
export function executionChannelPath(): string {
  if (platform() === "win32") {
    return "\\\\.\\pipe\\agentforge-execution";
  }
  return join("/tmp", "agentforge-execution.sock");
}
