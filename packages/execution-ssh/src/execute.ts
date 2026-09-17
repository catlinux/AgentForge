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
import { resolveCommandTemplate } from "./config/command-template.js";
import { findHost, type ExecutionConfig } from "./config/host-config.js";
import { executeOverSsh } from "./ssh/client.js";

export interface ExecuteDependencies {
  readonly config: ExecutionConfig;
  readonly confirmationChannel: ConfirmationChannel;
  readonly confirmationRegistry: OperationHashRegistry;
  readonly confirmationTimeoutMs: number;
  readonly sshTimeoutMs: number;
  /** Fetches the ssh-key secret (DEC-031) from the Secrets Broker for the given host. Injected
   * so this module never depends on a concrete Secrets Broker transport (DEC-010 still a
   * placeholder) — only on the already-approved secret record shape. */
  readonly getSshKeySecret: (hostId: string) => Promise<SecretRecord | undefined>;
  /** Optional (DEC-052/054/057): best-effort audit writer for the confirmation events this
   * function is responsible for (confirmation-requested, confirmation-resolved). Its absence or
   * any write failure never affects confirmation or execution behavior. */
  readonly auditWriter?: AuditWriter;
  /** Optional (Fase 10): tracks confirmations currently in flight, separate from
   * `confirmationRegistry` (DEC-038/045 security state) — used only so `execution-server.ts` can
   * tell a genuinely-pending cancellation apart from one with nothing to cancel. Never affects
   * authorization or execution. */
  readonly pendingConfirmations?: PendingConfirmations;
}

/**
 * Orchestrates a single execution attempt. Execution never re-evaluates policy — it only acts on
 * an already-produced `PolicyDecision`: `deny` is rejected outright, `requires-confirmation`
 * requires a fresh, single-use confirmation (DEC-038) before proceeding, and only `allow`
 * (optionally after confirmation) reaches the SSH client.
 */
export async function execute(
  request: ExecutionRequest,
  decision: PolicyDecision,
  deps: ExecuteDependencies,
): Promise<ExecutionOutcome> {
  if (decision.verdict === "deny") {
    return { kind: "denied", reason: `Policy Engine denied (${decision.ruleApplied})` };
  }

  const host = findHost(deps.config, request.hostId);
  if (host === undefined) {
    return { kind: "failed", reason: "Unknown host" };
  }

  const template = deps.config.commandTemplates[decision.identity];
  if (template === undefined) {
    return { kind: "failed", reason: "No command template configured for this tool" };
  }

  let resolvedCommand: readonly string[];
  try {
    resolvedCommand = resolveCommandTemplate(template, request.parameters);
  } catch {
    return { kind: "failed", reason: "Parameters do not match the configured command template" };
  }

  if (decision.verdict === "requires-confirmation") {
    let result;
    try {
      result = await confirmOperation(
        {
          identity: decision.identity,
          parameters: request.parameters,
          hostId: request.hostId,
          hostname: host.hostname,
          schemaFingerprint: decision.schemaFingerprint,
          resolvedCommand,
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
      // Any failure of the confirmation channel itself (e.g. an I/O error) must fail closed,
      // never fall through to execution (DEC-038 guarantee 5).
      return { kind: "confirmation-required-but-missing", reason: "channel-error" };
    }
    if (!result.outcome.confirmed) {
      return { kind: "confirmation-required-but-missing", reason: result.outcome.reason };
    }
  }

  const secret = await deps.getSshKeySecret(host.hostId);
  if (secret === undefined || secret.kind !== "ssh-key") {
    return { kind: "failed", reason: "SSH key secret not available for this host" };
  }
  const privateKey = secret.payload.privateKey;
  if (privateKey === undefined) {
    return { kind: "failed", reason: "SSH key secret is missing its private key" };
  }

  try {
    const result = await executeOverSsh(
      host,
      privateKey,
      secret.payload.passphrase,
      resolvedCommand,
      deps.sshTimeoutMs,
    );
    return { kind: "executed", ...result };
  } catch (error) {
    if (error instanceof Error && error.message === "SSH operation timed out") {
      return { kind: "timed-out" };
    }
    return { kind: "failed", reason: "SSH connection or execution error" };
  }
}
