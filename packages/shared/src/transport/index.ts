/**
 * Agnostic transport contract between AgentForge Core and the Secrets Broker (DEC-004, DEC-010).
 *
 * No implementation lives here — only the contract. Concrete implementations (Windows named
 * pipe, Unix domain socket) live in `packages/core` and `packages/secrets-broker` and are
 * selected at runtime based on `process.platform`. The vocabulary here is intentionally
 * OS-neutral: it must not leak Windows- or Unix-specific concepts (DEC-010).
 */
export interface SecretsBrokerTransport {
  /** Establishes the underlying IPC channel. Rejects if the channel cannot be opened. */
  connect(): Promise<void>;

  /** Sends a request to the Secrets Broker and resolves with its response. */
  request(message: SecretsBrokerRequest): Promise<SecretsBrokerResponse>;

  /** Closes the underlying IPC channel. */
  close(): Promise<void>;
}

export interface SecretsBrokerRequest {
  readonly type: string;
  readonly payload: unknown;
}

export interface SecretsBrokerResponse {
  readonly ok: boolean;
  readonly payload: unknown;
}
