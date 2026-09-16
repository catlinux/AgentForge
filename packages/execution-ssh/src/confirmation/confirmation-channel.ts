import type { OperationHash } from "./operation-hash.js";

/**
 * What is shown to the operator (DEC-038, guarantee 3): the real command and host as derived
 * from Execution's own configuration — never a description supplied by Core.
 */
export interface ConfirmationPrompt {
  readonly operationHash: OperationHash;
  readonly resolvedCommand: readonly string[];
  readonly hostname: string;
}

export type ConfirmationResponse =
  { readonly kind: "approved" } | { readonly kind: "rejected" } | { readonly kind: "timed-out" };

/**
 * Interaction mechanism for human confirmation, kept separate from the security logic in
 * confirm.ts (hash binding, single use, deny-by-default) — mirrors the pattern already used for
 * `SecretsBrokerTransport` (DEC-010) and the Tool Registry's MCP-compatible model (DEC-013): the
 * security contract must not be coupled to one concrete interaction mechanism, especially since
 * Claude Code has documented non-interactive modes where no human may be attached to this
 * process's stdio.
 */
export interface ConfirmationChannel {
  requestConfirmation(prompt: ConfirmationPrompt, timeoutMs: number): Promise<ConfirmationResponse>;
}
