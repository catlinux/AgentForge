import type { RiskLevel } from "../policy/risk.js";
import type { PolicyRuleApplied, PolicyVerdict } from "../policy/decision.js";
import type { ToolIdentity } from "../registry/identity.js";
import type { SessionId } from "../session/session-id.js";
import type { OperationId } from "./operation-id.js";

/**
 * Audit event model (DEC-054, minimization per DEC-055). Every event carries `eventId` (unique
 * per line), `operationId` (unique per `tools/call` invocation — never `OperationHash`),
 * `sessionId`, and a timestamp. Fields beyond that vary by event type and are only present when
 * genuinely known at the point the event is written (see `ToolInvokedEvent` in particular).
 *
 * Deliberately excluded from every event (DEC-055): secret/credential material, full
 * stdout/stderr content, raw parameter values, resolved command text, hostname/username, and raw
 * internal library error messages. See individual event shapes below for what IS captured.
 */
interface AuditEventBase {
  readonly eventId: string;
  readonly operationId: OperationId;
  readonly sessionId: SessionId;
  readonly timestamp: string;
}

/**
 * Written at the very start of `handleToolCall`, before `resolveToolEntry()` runs. At this point
 * `ToolIdentity` does NOT exist yet (it is the result of that call) and parameters have not been
 * validated against any schema — so this event intentionally carries only what is verified to be
 * available at that point in the code: the raw MCP tool name as the client sent it, the resolved
 * `hostId`, and the parameter *names* supplied (never their values, DEC-055).
 */
export interface ToolInvokedEvent extends AuditEventBase {
  readonly type: "tool-invoked";
  readonly mcpToolName: string;
  readonly hostId: string;
  readonly parameterNames: readonly string[];
}

export interface PolicyDecidedEvent extends AuditEventBase {
  readonly type: "policy-decided";
  readonly identity: ToolIdentity;
  readonly verdict: PolicyVerdict;
  readonly ruleApplied: PolicyRuleApplied;
  readonly baseRisk: RiskLevel | undefined;
}

export interface ConfirmationRequestedEvent extends AuditEventBase {
  readonly type: "confirmation-requested";
  readonly identity: ToolIdentity;
}

export interface ConfirmationResolvedEvent extends AuditEventBase {
  readonly type: "confirmation-resolved";
  readonly identity: ToolIdentity;
  readonly reason: "approved" | "rejected" | "timed-out" | "already-used" | "cancelled";
}

export interface ExecutionCompletedEvent extends AuditEventBase {
  readonly type: "execution-completed";
  readonly identity: ToolIdentity | undefined;
  readonly outcomeKind:
    | "executed"
    | "executed-http"
    | "denied"
    | "confirmation-required-but-missing"
    | "timed-out"
    | "failed"
    | "unknown-tool"
    | "execution-unavailable";
  readonly exitCode: number | undefined;
  readonly reason: string | undefined;
  readonly outputTruncated: boolean | undefined;
  /** Total bytes received before truncation (DEC-055) — only known when `outcomeKind ===
   * "executed"`, never the stdout/stderr content itself. */
  readonly stdoutBytes: number | undefined;
  readonly stderrBytes: number | undefined;
  /** HTTP status code and response body byte length (Fase 11, DEC-060) — only known when
   * `outcomeKind === "executed-http"`, never the response body content itself. */
  readonly statusCode: number | undefined;
  readonly responseBytes: number | undefined;
}

export type CancellationPhase = "before-execution" | "during-confirmation" | "after-authorization";

export interface OperationCancelledEvent extends AuditEventBase {
  readonly type: "operation-cancelled";
  readonly phase: CancellationPhase;
}

export type AuditEvent =
  | ToolInvokedEvent
  | PolicyDecidedEvent
  | ConfirmationRequestedEvent
  | ConfirmationResolvedEvent
  | ExecutionCompletedEvent
  | OperationCancelledEvent;

/**
 * Distributes `Omit` over the `AuditEvent` union member-by-member — plain `Omit<AuditEvent, ...>`
 * does not preserve discriminated-union narrowing in TypeScript, which would otherwise reject
 * valid per-variant object literals passed to `AuditWriter.write()`.
 */
export type AuditEventInput = AuditEvent extends infer E
  ? E extends AuditEvent
    ? Omit<E, "eventId" | "timestamp">
    : never
  : never;
