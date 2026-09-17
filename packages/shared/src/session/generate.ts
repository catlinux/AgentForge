import { randomUUID } from "node:crypto";
import type { SessionId } from "./session-id.js";

/**
 * Generates a new `SessionId` (DEC-050). Own generation, not derived from the MCP SDK's
 * transport-level `sessionId` — `StdioServerTransport` (DEC-046) never assigns one; that
 * capability is exclusive to HTTP/Streamable transports with reconnection, verified against the
 * installed SDK before this decision was made.
 */
export function generateSessionId(): SessionId {
  return randomUUID() as SessionId;
}
