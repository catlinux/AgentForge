import type { SecretId } from "./identity.js";
import type { SecretRecord } from "./record.js";

/**
 * Domain contract for the Execution Backend <-> Secrets Broker IPC channel (Fase 13, DEC-F).
 * Deliberately NOT `SecretsBrokerOperation`/`SecretsBrokerResult` (DEC-033) — those model the
 * full Broker API (`get`/`create`/`update`/`delete`/`exists`/`listMetadata`) intended for Core.
 * An Execution Backend only ever needs to *read* one secret it was already told to use (by its
 * own declarative host/account configuration, Fase 7/11) — never to create, modify, delete, or
 * enumerate secrets. This channel exposes only `get`, on a distinct, minimal contract, so an
 * Execution Backend cannot exercise the Broker's full API even if its process were compromised.
 *
 * Reuses the transport *pattern* only (agnostic interface + OS-level ACL'd named pipe/Unix
 * socket, same as DEC-010/DEC-047) — never `SecretsBrokerTransport` itself (still an unimplemented
 * placeholder, DEC-010) and never the MCP-server<->Execution channel of DEC-047. Three logically
 * distinct pairs of processes, three distinct domain contracts, one shared transport pattern.
 */
export interface ExecutionSecretsChannelRequest {
  readonly id: SecretId;
}

export type ExecutionSecretsChannelResponse =
  | { readonly ok: true; readonly record: SecretRecord }
  | { readonly ok: false; readonly reason: string };

/** Client-side view of the channel, used by an Execution Backend process. */
export interface ExecutionSecretsChannelClient {
  connect(): Promise<void>;
  get(id: SecretId): Promise<ExecutionSecretsChannelResponse>;
  close(): Promise<void>;
}
