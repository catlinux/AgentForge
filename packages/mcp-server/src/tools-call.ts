import type {
  ExecutionChannelClient,
  ExecutionChannelRequest,
  PolicyDecision,
  SessionId,
  ToolEntry,
} from "@agentforge/shared";

export interface McpToolResult {
  readonly isError: boolean;
  readonly content: string;
}

export interface ToolsCallDeps {
  /** Resolves the MCP tool name (Discovery's `qualifiedName`) back to its Registry entry. */
  readonly resolveToolEntry: (mcpToolName: string) => Promise<ToolEntry | undefined>;
  readonly evaluate: (entry: ToolEntry) => Promise<PolicyDecision>;
  readonly executionClient: ExecutionChannelClient;
  /** Emits a progress notification to keep the MCP client's timeout window open (DEC-045). */
  readonly sendProgress: () => void;
  /** Resolves when the MCP client sends `notifications/cancelled` for this call (DEC-045). */
  readonly cancelled: AbortSignal;
  readonly progressIntervalMs: number;
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
 * `sessionId` (DEC-049) is carried through purely as correlation metadata — it never affects
 * policy evaluation, confirmation, or execution logic.
 */
export async function handleToolCall(
  mcpToolName: string,
  args: Readonly<Record<string, string>>,
  hostId: string,
  sessionId: SessionId,
  deps: ToolsCallDeps,
): Promise<McpToolResult> {
  const entry = await deps.resolveToolEntry(mcpToolName);
  if (entry === undefined) {
    return { isError: true, content: "Unknown tool" };
  }
  const identity = entry.identity;

  const decision = await deps.evaluate(entry);

  // Checked before issuing the request at all: if the call was already cancelled by the time
  // policy evaluation finished, never even contact Execution (DEC-045).
  if (deps.cancelled.aborted) {
    await deps.executionClient.cancel(identity, hostId, args, decision.schemaFingerprint);
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
    };

    const requestPromise = deps.executionClient.request(channelRequest);
    const cancellation = new Promise<"cancelled">((resolve) => {
      deps.cancelled.addEventListener("abort", () => resolve("cancelled"), { once: true });
    });

    const raced = await Promise.race([requestPromise, cancellation]);

    if (raced === "cancelled") {
      // DEC-045 guarantee 3/4: propagate the cancellation to Execution's hash registry so a
      // late approval is discarded there, then stop waiting — never report a result for this
      // call afterwards, even if `requestPromise` later resolves.
      await deps.executionClient.cancel(identity, hostId, args, decision.schemaFingerprint);
      return { isError: true, content: "Cancelled" };
    }

    const response = raced;
    if (!response.ok) {
      return { isError: true, content: response.reason };
    }
    if (response.outcome.kind === "executed") {
      return {
        isError: response.outcome.exitCode !== 0,
        content: JSON.stringify(response.outcome),
      };
    }
    return { isError: true, content: JSON.stringify(response.outcome) };
  } finally {
    clearInterval(progressTimer);
  }
}
