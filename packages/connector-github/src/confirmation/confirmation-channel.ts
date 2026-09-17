import type { OperationHash } from "./operation-hash.js";

/**
 * What is shown to the operator (DEC-038, guarantee 3): the real operation and account as derived
 * from this connector's own configuration — never a description supplied by Core. Same shape as
 * `execution-ssh`'s `ConfirmationPrompt`, with field names generalized from SSH-specific
 * ("resolvedCommand"/"hostname") to this connector's domain (an HTTP operation against a
 * configured GitHub account, not a shell command against a host).
 */
export interface ConfirmationPrompt {
  readonly operationHash: OperationHash;
  /** e.g. ["POST", "/repos/{owner}/{repo}/issues"] — the resolved HTTP method + path, never a
   * request body (DEC-055 minimization: never registered/shown as free-form content). */
  readonly operationSummary: readonly string[];
  /** The configured GitHub account label the operation runs against — never the token itself. */
  readonly accountLabel: string;
}

export type ConfirmationResponse =
  { readonly kind: "approved" } | { readonly kind: "rejected" } | { readonly kind: "timed-out" };

/**
 * Interaction mechanism for human confirmation, kept separate from the security logic in
 * confirm.ts (hash binding, single use, deny-by-default) — same separation as
 * `execution-ssh/src/confirmation/confirmation-channel.ts`.
 */
export interface ConfirmationChannel {
  requestConfirmation(prompt: ConfirmationPrompt, timeoutMs: number): Promise<ConfirmationResponse>;
}
