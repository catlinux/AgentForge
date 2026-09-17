import { describe, expect, it } from "vitest";
import type { OperationId, SchemaFingerprint, SessionId, ToolIdentity } from "@agentforge/shared";
import type {
  ConfirmationChannel,
  ConfirmationPrompt,
  ConfirmationResponse,
} from "./confirmation-channel.js";
import { confirmOperation, type ConfirmationRequest } from "./confirm.js";
import { OperationHashRegistry } from "./hash-registry.js";
import { cancelOperation } from "./cancel.js";
import { PendingConfirmations } from "./pending-confirmations.js";
import { computeOperationHash } from "./operation-hash.js";

class ScriptedChannel implements ConfirmationChannel {
  public readonly promptsSeen: ConfirmationPrompt[] = [];
  constructor(private readonly response: ConfirmationResponse) {}
  async requestConfirmation(prompt: ConfirmationPrompt): Promise<ConfirmationResponse> {
    this.promptsSeen.push(prompt);
    return this.response;
  }
}

function makeRequest(overrides: Partial<ConfirmationRequest> = {}): ConfirmationRequest {
  return {
    identity: "tool-1" as ToolIdentity,
    parameters: { owner: "acme", repo: "widgets" },
    hostId: "account-1",
    accountLabel: "acme-bot",
    schemaFingerprint: "fp-1" as SchemaFingerprint,
    operationSummary: ["POST", "/repos/acme/widgets/issues"],
    sessionId: "session-1" as SessionId,
    operationId: "operation-1" as OperationId,
    ...overrides,
  };
}

describe("confirmOperation (DEC-038)", () => {
  it("approved: returns confirmed and marks the hash as used", async () => {
    const channel = new ScriptedChannel({ kind: "approved" });
    const registry = new OperationHashRegistry();
    const { outcome, operationHash } = await confirmOperation(
      makeRequest(),
      channel,
      registry,
      1000,
    );

    expect(outcome).toEqual({ confirmed: true });
    expect(registry.get(operationHash)).toBe("used");
  });

  it("guarantee 2 (single use): a second attempt with the exact same tuple is refused", async () => {
    const channel = new ScriptedChannel({ kind: "approved" });
    const registry = new OperationHashRegistry();
    const first = await confirmOperation(makeRequest(), channel, registry, 1000);
    expect(first.outcome.confirmed).toBe(true);

    const second = await confirmOperation(makeRequest(), channel, registry, 1000);
    expect(second.outcome).toEqual({ confirmed: false, reason: "already-used" });
  });

  it("a different operation (different parameters) is NOT blocked by a prior approval", async () => {
    const channel = new ScriptedChannel({ kind: "approved" });
    const registry = new OperationHashRegistry();
    await confirmOperation(
      makeRequest({ parameters: { owner: "acme", repo: "widgets" } }),
      channel,
      registry,
      1000,
    );

    const different = await confirmOperation(
      makeRequest({ parameters: { owner: "acme", repo: "other" } }),
      channel,
      registry,
      1000,
    );
    expect(different.outcome.confirmed).toBe(true);
  });

  it("guarantee 4/5: rejected response denies, does not consume the hash for future replay", async () => {
    const channel = new ScriptedChannel({ kind: "rejected" });
    const registry = new OperationHashRegistry();
    const { outcome, operationHash } = await confirmOperation(
      makeRequest(),
      channel,
      registry,
      1000,
    );

    expect(outcome).toEqual({ confirmed: false, reason: "rejected" });
    expect(registry.get(operationHash)).toBeUndefined();
  });

  it("guarantee 4: timeout denies by default", async () => {
    const channel = new ScriptedChannel({ kind: "timed-out" });
    const registry = new OperationHashRegistry();
    const { outcome } = await confirmOperation(makeRequest(), channel, registry, 1000);

    expect(outcome).toEqual({ confirmed: false, reason: "timed-out" });
  });

  it("guarantee 3: the channel is shown the real operation summary and account, not raw Core data", async () => {
    const channel = new ScriptedChannel({ kind: "approved" });
    const registry = new OperationHashRegistry();
    await confirmOperation(
      makeRequest({
        operationSummary: ["POST", "/repos/acme/widgets/issues"],
        accountLabel: "acme-bot",
      }),
      channel,
      registry,
      1000,
    );

    expect(channel.promptsSeen[0]?.operationSummary).toEqual([
      "POST",
      "/repos/acme/widgets/issues",
    ]);
    expect(channel.promptsSeen[0]?.accountLabel).toBe("acme-bot");
  });

  // --- DEC-045: MCP tools/call cancellation ---

  it("cancellation before confirmation: a subsequent approval is discarded", async () => {
    const req = makeRequest();
    const channel = new ScriptedChannel({ kind: "approved" });
    const registry = new OperationHashRegistry();

    const cancelled = cancelOperation(
      registry,
      req.identity,
      req.parameters,
      req.hostId,
      req.schemaFingerprint,
    );
    expect(cancelled).toBe(true);

    const { outcome } = await confirmOperation(req, channel, registry, 1000);
    expect(outcome).toEqual({ confirmed: false, reason: "cancelled" });
  });

  it("approval after cancellation: never reaches confirmed:true, even though the operator said yes", async () => {
    const req = makeRequest();
    const channel = new ScriptedChannel({ kind: "approved" });
    const registry = new OperationHashRegistry();

    cancelOperation(registry, req.identity, req.parameters, req.hostId, req.schemaFingerprint);

    const { outcome } = await confirmOperation(req, channel, registry, 1000);
    expect(outcome.confirmed).toBe(false);
  });

  it("race: cancellation recorded while the operator's approval is in flight is honored, not the approval", async () => {
    const req = makeRequest();
    const registry = new OperationHashRegistry();

    class RaceChannel implements ConfirmationChannel {
      async requestConfirmation(): Promise<ConfirmationResponse> {
        cancelOperation(registry, req.identity, req.parameters, req.hostId, req.schemaFingerprint);
        return { kind: "approved" };
      }
    }

    const { outcome } = await confirmOperation(req, new RaceChannel(), registry, 1000);
    expect(outcome).toEqual({ confirmed: false, reason: "cancelled" });
  });

  it("cancellation after the confirmation was already approved does not retroactively invalidate it", async () => {
    const req = makeRequest();
    const channel = new ScriptedChannel({ kind: "approved" });
    const registry = new OperationHashRegistry();

    const { outcome } = await confirmOperation(req, channel, registry, 1000);
    expect(outcome.confirmed).toBe(true);

    const cancelledSuccessfully = cancelOperation(
      registry,
      req.identity,
      req.parameters,
      req.hostId,
      req.schemaFingerprint,
    );
    expect(cancelledSuccessfully).toBe(false);
    expect(registry.get((await confirmOperation(req, channel, registry, 1000)).operationHash)).toBe(
      "used",
    );
  });

  // --- Fase 10/11: PendingConfirmations (audit-only tracking, never authorization) ---

  it("marks the hash pending before requesting confirmation, and clears it once resolved (approved)", async () => {
    const pendingSeen: boolean[] = [];
    const channel: ConfirmationChannel = {
      requestConfirmation: async () => {
        pendingSeen.push(pending.has(operationHashFor(makeRequest())));
        return { kind: "approved" };
      },
    };
    const registry = new OperationHashRegistry();
    const pending = new PendingConfirmations();

    await confirmOperation(makeRequest(), channel, registry, 1000, undefined, pending);

    expect(pendingSeen).toEqual([true]);
    expect(pending.has(operationHashFor(makeRequest()))).toBe(false);
  });

  it("clears the pending entry even when the channel throws", async () => {
    const channel: ConfirmationChannel = {
      requestConfirmation: async () => {
        throw new Error("channel I/O error");
      },
    };
    const registry = new OperationHashRegistry();
    const pending = new PendingConfirmations();

    await expect(
      confirmOperation(makeRequest(), channel, registry, 1000, undefined, pending),
    ).rejects.toThrow("channel I/O error");

    expect(pending.has(operationHashFor(makeRequest()))).toBe(false);
  });

  it("never marks the hash pending when it was already resolved (used/cancelled) — no channel call happens", async () => {
    const req = makeRequest();
    const channel = new ScriptedChannel({ kind: "approved" });
    const registry = new OperationHashRegistry();
    const pending = new PendingConfirmations();

    cancelOperation(registry, req.identity, req.parameters, req.hostId, req.schemaFingerprint);
    await confirmOperation(req, channel, registry, 1000, undefined, pending);

    expect(pending.has(operationHashFor(req))).toBe(false);
    expect(channel.promptsSeen).toHaveLength(0);
  });
});

function operationHashFor(req: ConfirmationRequest) {
  return computeOperationHash(req.identity, req.parameters, req.hostId, req.schemaFingerprint);
}
