import type {
  AuditWriter,
  ExecutionChannelClient,
  ExecutionChannelRequest,
  OperationId,
  PolicyDecision,
  SessionId,
  ToolEntry,
} from "@agentforge/shared";
import { generateOperationId } from "@agentforge/shared";

export interface McpToolResult {
  readonly isError: boolean;
  readonly content: string;
}

export interface ToolsCallDeps {
  /** Resolves the MCP tool name (Discovery's `qualifiedName`) back to its Registry entry. */
  readonly resolveToolEntry: (mcpToolName: string) => Promise<ToolEntry | undefined>;
  readonly evaluate: (entry: ToolEntry) => Promise<PolicyDecision>;
  /** Selects which Execution Backend process handles this tool, by `ToolEntry.origin.id` (Fase
   * 11, DEC-058: one `ExecutionChannelClient` per backend — e.g. "execution-ssh",
   * "connector-github" — never a single fixed client). Returns `undefined` if no backend is
   * configured for that origin, treated identically to a failed IPC connection (fail-closed,
   * DEC-047) — never a silent pass-through. */
  readonly resolveExecutionClient: (originId: string) => ExecutionChannelClient | undefined;
  /** Emits a progress notification to keep the MCP client's timeout window open (DEC-045). */
  readonly sendProgress: () => void;
  /** Resolves when the MCP client sends `notifications/cancelled` for this call (DEC-045). */
  readonly cancelled: AbortSignal;
  readonly progressIntervalMs: number;
  /** Optional (DEC-052/057): best-effort audit writer for events this process is responsible
   * for (tool-invoked, policy-decided, operation-cancelled). Its absence or any write failure
   * never affects this function's behavior. */
  readonly auditWriter?: AuditWriter;
}

/**
 * Handles a single `tools/call` (DEC-045). Never re-evaluates policy beyond calling
 * `evaluate()` once; never executes free-form input — parameters are forwarded to Execution
 * exactly as received from the client, and Execution itself (DEC-037) is the only place that
 * resolves them against a fixed command template.
 *
 * Cancellation handling: while waiting on Execution's response, this function races the
 * Execution request against `cancelled`. If cancellation wins, it propagates the cancellation to
 * Execution (so the operation-hash registry there can discard a late approval, DEC-045
 * guarantee 4) and returns immediately — it does NOT wait for Execution's original request to
 * resolve, and it never later reports a result for a call the client already gave up on.
 *
 * `sessionId` (DEC-049) and `operationId` (DEC-054, generated here — once per invocation,
 * regardless of outcome) are carried through purely as correlation metadata — neither ever
 * affects policy evaluation, confirmation, or execution logic (DEC-056).
 */
export async function handleToolCall(
  mcpToolName: string,
  args: Readonly<Record<string, string>>,
  hostId: string,
  sessionId: SessionId,
  deps: ToolsCallDeps,
): Promise<McpToolResult> {
  const operationId: OperationId = generateOperationId();

  // tool-invoked (DEC-054): written before resolveToolEntry() runs, so it intentionally never
  // includes ToolIdentity (doesn't exist yet) nor validated parameters — only what is genuinely
  // known at this point: the raw MCP tool name, the already-resolved hostId, and parameter
  // *names* (never values, DEC-055).
  void deps.auditWriter?.write({
    type: "tool-invoked",
    operationId,
    sessionId,
    mcpToolName,
    hostId,
    parameterNames: Object.keys(args),
  });

  const entry = await deps.resolveToolEntry(mcpToolName);
  if (entry === undefined) {
    void deps.auditWriter?.write({
      type: "execution-completed",
      operationId,
      sessionId,
      identity: undefined,
      outcomeKind: "unknown-tool",
      exitCode: undefined,
      reason: "Unknown tool",
      outputTruncated: undefined,
      stdoutBytes: undefined,
      stderrBytes: undefined,
      statusCode: undefined,
      responseBytes: undefined,
    });
    return { isError: true, content: "Unknown tool" };
  }
  const identity = entry.identity;
  const executionClient = deps.resolveExecutionClient(entry.origin.id);

  const decision = await deps.evaluate(entry);
  void deps.auditWriter?.write({
    type: "policy-decided",
    operationId,
    sessionId,
    identity,
    verdict: decision.verdict,
    ruleApplied: decision.ruleApplied,
    baseRisk: decision.baseRisk,
  });

  // Fail closed if no Execution Backend is configured for this tool's origin (Fase 11, DEC-058)
  // — never a silent pass-through, same treatment as a failed IPC connection below.
  if (executionClient === undefined) {
    void deps.auditWriter?.write({
      type: "execution-completed",
      operationId,
      sessionId,
      identity,
      outcomeKind: "execution-unavailable",
      exitCode: undefined,
      reason: `No Execution Backend configured for origin "${entry.origin.id}"`,
      outputTruncated: undefined,
      stdoutBytes: undefined,
      stderrBytes: undefined,
      statusCode: undefined,
      responseBytes: undefined,
    });
    return {
      isError: true,
      content: `No Execution Backend configured for origin "${entry.origin.id}"`,
    };
  }

  // Checked before issuing the request at all: if the call was already cancelled by the time
  // policy evaluation finished, never even contact Execution (DEC-045).
  if (deps.cancelled.aborted) {
    await executionClient.cancel(
      identity,
      hostId,
      args,
      decision.schemaFingerprint,
      sessionId,
      operationId,
    );
    void deps.auditWriter?.write({
      type: "operation-cancelled",
      operationId,
      sessionId,
      phase: "before-execution",
    });
    return { isError: true, content: "Cancelled" };
  }

  const progressTimer = setInterval(deps.sendProgress, deps.progressIntervalMs);
  try {
    const channelRequest: ExecutionChannelRequest = {
      identity,
      hostId,
      parameters: args,
      decision,
      sessionId,
      operationId,
    };

    const requestPromise = executionClient.request(channelRequest);
    const cancellation = new Promise<"cancelled">((resolve) => {
      deps.cancelled.addEventListener("abort", () => resolve("cancelled"), { once: true });
    });

    const raced = await Promise.race([requestPromise, cancellation]);

    if (raced === "cancelled") {
      // DEC-045 guarantee 3/4: propagate the cancellation to Execution's hash registry so a
      // late approval is discarded there, then stop waiting — never report a result for this
      // call afterwards, even if `requestPromise` later resolves. The cancellation phase here
      // covers both "during-confirmation" and "after-authorization" from Execution's point of
      // view — from the MCP server's own perspective it only knows "the client cancelled while
      // I was waiting for Execution's response", so a single phase is accurate here; Execution's
      // own confirmation-resolved/execution-completed events carry the more precise distinction.
      await executionClient.cancel(
        identity,
        hostId,
        args,
        decision.schemaFingerprint,
        sessionId,
        operationId,
      );
      void deps.auditWriter?.write({
        type: "operation-cancelled",
        operationId,
        sessionId,
        phase:
          decision.verdict === "requires-confirmation"
            ? "during-confirmation"
            : "after-authorization",
      });
      return { isError: true, content: "Cancelled" };
    }

    const response = raced;
    if (!response.ok) {
      void deps.auditWriter?.write({
        type: "execution-completed",
        operationId,
        sessionId,
        identity,
        outcomeKind: "execution-unavailable",
        exitCode: undefined,
        reason: response.reason,
        outputTruncated: undefined,
        stdoutBytes: undefined,
        stderrBytes: undefined,
        statusCode: undefined,
        responseBytes: undefined,
      });
      return { isError: true, content: response.reason };
    }
    if (response.outcome.kind === "executed") {
      return {
        isError: response.outcome.exitCode !== 0,
        content: JSON.stringify(response.outcome),
      };
    }
    if (response.outcome.kind === "executed-http") {
      return {
        isError: response.outcome.statusCode >= 400,
        content: JSON.stringify(response.outcome),
      };
    }
    return { isError: true, content: JSON.stringify(response.outcome) };
  } finally {
    clearInterval(progressTimer);
  }
}
