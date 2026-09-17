import { createServer, type Server, type Socket } from "node:net";
import type { ExecutionSecretsChannelResponse, SecretId } from "@agentforge/shared";
import type { SecretStore } from "../storage/secret-store.js";

type IncomingMessage = { readonly id: SecretId };

/**
 * Server side of the Execution Backend <-> Secrets Broker IPC channel (Fase 13, DEC-F). Exposes
 * only a `get` — never the full `SecretsBrokerOperation` set (DEC-033) — so an Execution Backend
 * cannot create, modify, delete, or enumerate secrets even if its process were compromised
 * (least privilege, same reasoning as the channel's own contract in
 * `packages/shared/src/secrets/execution-secrets-channel.ts`).
 *
 * DEC-034/036 still apply unchanged: no binding against a caller-declared origin, and no
 * cryptographic authorization evidence validated — any request arriving over this OS-authenticated
 * channel is treated as coming from a legitimate Execution Backend process. Error messages never
 * include secret payload values or internal storage error details (same discipline as
 * `handle-operation.ts`).
 */
export function startExecutionSecretsServer(store: SecretStore, socketPath: string): Server {
  const server = createServer((socket: Socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.trim().length === 0) continue;
        void handleLine(line, socket, store);
      }
    });
    socket.on("error", () => {
      // Never let a socket-level error crash the server process; the client sees the connection
      // drop, which it must treat as fail-closed (same rule as DEC-047).
    });
  });
  server.listen(socketPath);
  return server;
}

async function handleLine(line: string, socket: Socket, store: SecretStore): Promise<void> {
  let message: IncomingMessage;
  try {
    message = JSON.parse(line) as IncomingMessage;
  } catch {
    writeResponse(socket, { ok: false, reason: "Malformed request" });
    return;
  }

  try {
    const record = await store.get(message.id);
    if (record === undefined) {
      writeResponse(socket, { ok: false, reason: "Secret not found" });
      return;
    }
    writeResponse(socket, { ok: true, record });
  } catch {
    // Never surface the underlying storage error (could describe file paths, corruption
    // details, or crypto internals) — same discipline as handle-operation.ts.
    writeResponse(socket, { ok: false, reason: "Secrets Broker operation failed" });
  }
}

function writeResponse(socket: Socket, response: ExecutionSecretsChannelResponse): void {
  socket.write(`${JSON.stringify(response)}\n`);
}
