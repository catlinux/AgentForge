import type {
  AuditWriter,
  ExecutionOutcome,
  ExecutionRequest,
  PolicyDecision,
  SecretRecord,
} from "@agentforge/shared";
import type { ConfirmationChannel } from "./confirmation/confirmation-channel.js";
import { confirmOperation } from "./confirmation/confirm.js";
import type { OperationHashRegistry } from "./confirmation/hash-registry.js";
import type { PendingConfirmations } from "./confirmation/pending-confirmations.js";
import { resolveOperationTemplate } from "./config/operation-template.js";
import { findAccount, type ConnectorConfig } from "./config/account-config.js";
import { sendGithubRequest } from "./github/client.js";

export interface ExecuteDependencies {
  readonly config: ConnectorConfig;
  readonly confirmationChannel: ConfirmationChannel;
  readonly confirmationRegistry: OperationHashRegistry;
  readonly confirmationTimeoutMs: number;
  readonly httpTimeoutMs: number;
  /** Fetches the PAT secret (DEC-031, kind "token") from the Secrets Broker for the given
   * `SecretId`. Injected, exactly like `execution-ssh`'s `getSshKeySecret` — kept as an
   * injectable dependency so this module never depends on a concrete transport; the real
   * Secrets Broker channel (DEC-070, Fase 13) is now the default `startConnectorServer` wires in
   * when the caller does not inject one explicitly (see `ipc/connector-server.ts`). */
  readonly getTokenSecret: (secretId: string) => Promise<SecretRecord | undefined>;
  /** Optional (DEC-052/054/057): best-effort audit writer for the confirmation events this
   * function is responsible for (confirmation-requested, confirmation-resolved). */
  readonly auditWriter?: AuditWriter;
  /** Optional (Fase 10): tracks confirmations currently in flight — see pending-confirmations.ts. */
  readonly pendingConfirmations?: PendingConfirmations;
}

/**
 * Orchestrates a single GitHub connector operation (Fase 11, DEC-058/060/061/062). Never
 * re-evaluates policy — only acts on an already-produced `PolicyDecision`, same discipline as
 * `execution-ssh`'s `execute()`: `deny` is rejected outright, `requires-confirmation` requires a
 * fresh, single-use confirmation (DEC-038) before proceeding, and only `allow` (optionally after
 * confirmation) reaches the GitHub API.
 */
export async function execute(
  request: ExecutionRequest,
  decision: PolicyDecision,
  deps: ExecuteDependencies,
): Promise<ExecutionOutcome> {
  if (decision.verdict === "deny") {
    return { kind: "denied", reason: `Policy Engine denied (${decision.ruleApplied})` };
  }

  const account = findAccount(deps.config, request.hostId);
  if (account === undefined) {
    return { kind: "failed", reason: "Unknown account" };
  }

  const template = deps.config.operationTemplates[decision.identity];
  if (template === undefined) {
    return { kind: "failed", reason: "No operation template configured for this tool" };
  }

  let resolvedOperation;
  try {
    resolvedOperation = resolveOperationTemplate(template, request.parameters);
  } catch {
    return { kind: "failed", reason: "Parameters do not match the configured operation template" };
  }
  const operationSummary = [resolvedOperation.method, resolvedOperation.path];

  if (decision.verdict === "requires-confirmation") {
    let result;
    try {
      result = await confirmOperation(
        {
          identity: decision.identity,
          parameters: request.parameters,
          hostId: request.hostId,
          accountLabel: account.accountId,
          schemaFingerprint: decision.schemaFingerprint,
          operationSummary,
          sessionId: request.sessionId,
          operationId: request.operationId,
        },
        deps.confirmationChannel,
        deps.confirmationRegistry,
        deps.confirmationTimeoutMs,
        deps.auditWriter,
        deps.pendingConfirmations,
      );
    } catch {
      // Any failure of the confirmation channel itself must fail closed (DEC-038 guarantee 5).
      return { kind: "confirmation-required-but-missing", reason: "channel-error" };
    }
    if (!result.outcome.confirmed) {
      return { kind: "confirmation-required-but-missing", reason: result.outcome.reason };
    }
  }

  const secret = await deps.getTokenSecret(account.tokenSecretId);
  if (secret === undefined || secret.kind !== "token") {
    return { kind: "failed", reason: "Token secret not available for this account" };
  }
  const token = secret.payload.value;
  if (token === undefined) {
    return { kind: "failed", reason: "Token secret is missing its value" };
  }

  try {
    const result = await sendGithubRequest(
      account.apiBaseUrl,
      token,
      resolvedOperation,
      deps.httpTimeoutMs,
    );
    return { kind: "executed-http", ...result };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { kind: "timed-out" };
    }
    return { kind: "failed", reason: "GitHub API connection or request error" };
  }
}
