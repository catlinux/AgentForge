import { connect, type Socket } from "node:net";
import type { SecretId } from "./identity.js";
import type {
  ExecutionSecretsChannelClient,
  ExecutionSecretsChannelResponse,
} from "./execution-secrets-channel.js";

/**
 * Client side of the Execution Backend <-> Secrets Broker IPC channel (Fase 13, DEC-F). Shared by
 * every Execution Backend (`execution-ssh`, `connector-github`, and any future one) rather than
 * duplicated per package — unlike the confirmation state machine, which Fase 11 deliberately
 * duplicated per backend (DEC-058) because it carries backend-specific security state. This
 * client carries no state beyond the socket connection itself, so sharing it introduces no
 * cross-backend coupling.
 *
 * Same fail-closed discipline as `NetExecutionChannelClient` (DEC-047): any connection failure,
 * malformed response, or ambiguity resolves as `ok: false`, never as an implicit fallback.
 *
 * Fase 13 hardening: every `startExecutionServer`/`startConnectorServer` instance shares ONE
 * instance of this client (one socket) across every concurrent `execute` request it handles — so
 * `get()` calls MUST be serialized (one request in flight at a time) rather than each attaching
 * its own `data` listener to the same socket. The protocol carries no correlation id, so two
 * requests racing on the wire could otherwise resolve each other's promise with the wrong
 * response — silently handing one caller's secret (e.g. a different host's SSH key or a
 * different account's token) to the wrong request. A FIFO queue removes the race entirely without
 * changing the channel's wire format.
 */
export class NetExecutionSecretsChannelClient implements ExecutionSecretsChannelClient {
  private socket: Socket | undefined;
  private queue: Promise<unknown> = Promise.resolve();

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

  async get(id: SecretId): Promise<ExecutionSecretsChannelResponse> {
    const socket = this.socket;
    if (socket === undefined) {
      return { ok: false, reason: "Not connected to Secrets Broker" };
    }
    // Chain onto the queue so this request's own request/response round trip never overlaps with
    // another `get()` call's listeners on the same shared socket — the next caller's request is
    // only written to the wire after this one has fully settled.
    const request = this.queue.then(() => this.sendAndAwaitResponse(socket, id));
    // Swallow rejections in the queue chain itself so one failed request never poisons the queue
    // for subsequent callers — `sendAndAwaitResponse` never rejects (it always resolves to an
    // `ExecutionSecretsChannelResponse`), but this guard keeps the chain alive even if that ever
    // changed.
    this.queue = request.catch(() => undefined);
    return request;
  }

  private sendAndAwaitResponse(
    socket: Socket,
    id: SecretId,
  ): Promise<ExecutionSecretsChannelResponse> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (response: ExecutionSecretsChannelResponse): void => {
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
          finish(JSON.parse(line) as ExecutionSecretsChannelResponse);
        } catch {
          finish({ ok: false, reason: "Malformed response from Secrets Broker" });
        }
      }
      function onClose(): void {
        finish({ ok: false, reason: "Connection to Secrets Broker lost" });
      }

      socket.on("data", onData);
      socket.on("close", onClose);
      socket.write(`${JSON.stringify({ id })}\n`);
    });
  }

  async close(): Promise<void> {
    this.socket?.end();
    this.socket = undefined;
  }
}
