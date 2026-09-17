import { connect, type Socket } from "node:net";
import type {
  ExecutionChannelClient,
  ExecutionChannelRequest,
  ExecutionChannelResponse,
  OperationId,
  SchemaFingerprint,
  SessionId,
  ToolIdentity,
} from "@agentforge/shared";

/**
 * Client side of the MCP-server <-> Execution IPC channel (DEC-047). Any connection failure,
 * malformed response, or ambiguity is treated as fail-closed (`ok: false`) — never as an implicit
 * "proceed without confirmation". No automatic reconnect-and-retry across a request boundary:
 * a lost connection mid-operation resolves that single request as failed rather than attempting
 * to recover a result that might already be indeterminate on the Execution side (DEC-047).
 */
export class NetExecutionChannelClient implements ExecutionChannelClient {
  private socket: Socket | undefined;

  constructor(private readonly socketPath: string) {}

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = connect(this.socketPath);
      socket.once("connect", () => {
        this.socket = socket;
        resolve();
      });
      socket.once("error", (err) => {
        reject(err);
      });
    });
  }

  async request(req: ExecutionChannelRequest): Promise<ExecutionChannelResponse> {
    const socket = this.socket;
    if (socket === undefined) {
      return { ok: false, reason: "Not connected to Execution" };
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (response: ExecutionChannelResponse): void => {
        if (settled) return;
        settled = true;
        socket.off("data", onData);
        socket.off("close", onClose);
        resolve(response);
      };

      let buffer = "";
      function onData(chunk: Buffer): void {
        buffer += chunk.toString("utf-8");
        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex === -1) return;
        const line = buffer.slice(0, newlineIndex);
        try {
          finish(JSON.parse(line) as ExecutionChannelResponse);
        } catch {
          finish({ ok: false, reason: "Malformed response from Execution" });
        }
      }
      function onClose(): void {
        // Connection lost mid-request — fail closed, never assume the operation proceeded.
        finish({ ok: false, reason: "Connection to Execution lost" });
      }

      socket.on("data", onData);
      socket.on("close", onClose);
      socket.write(`${JSON.stringify({ kind: "execute", request: req })}\n`);
    });
  }

  async cancel(
    identity: ToolIdentity,
    hostId: string,
    parameters: Readonly<Record<string, string>>,
    schemaFingerprint: SchemaFingerprint,
    sessionId: SessionId,
    operationId: OperationId,
  ): Promise<void> {
    const socket = this.socket;
    if (socket === undefined) {
      return;
    }
    socket.write(
      `${JSON.stringify({
        kind: "cancel",
        identity,
        hostId,
        parameters,
        schemaFingerprint,
        sessionId,
        operationId,
      })}\n`,
    );
  }

  async close(): Promise<void> {
    this.socket?.end();
    this.socket = undefined;
  }
}
