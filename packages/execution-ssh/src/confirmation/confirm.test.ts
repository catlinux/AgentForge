import { describe, expect, it } from "vitest";
import type { SchemaFingerprint, ToolIdentity } from "@agentforge/shared";
import type {
  ConfirmationChannel,
  ConfirmationPrompt,
  ConfirmationResponse,
} from "./confirmation-channel.js";
import { confirmOperation, type ConfirmationRequest } from "./confirm.js";
import type { OperationHash } from "./operation-hash.js";

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
    parameters: { path: "/a" },
    hostId: "host-1",
    hostname: "example.internal",
    schemaFingerprint: "fp-1" as SchemaFingerprint,
    resolvedCommand: ["cat", "/a"],
    ...overrides,
  };
}

describe("confirmOperation (DEC-038)", () => {
  it("approved: returns confirmed and marks the hash as used", async () => {
    const channel = new ScriptedChannel({ kind: "approved" });
    const used = new Set<OperationHash>();
    const result = await confirmOperation(makeRequest(), channel, used, 1000);

    expect(result).toEqual({ confirmed: true });
    expect(used.size).toBe(1);
  });

  it("guarantee 2 (single use): a second attempt with the exact same tuple is refused", async () => {
    const channel = new ScriptedChannel({ kind: "approved" });
    const used = new Set<OperationHash>();
    const first = await confirmOperation(makeRequest(), channel, used, 1000);
    expect(first.confirmed).toBe(true);

    const second = await confirmOperation(makeRequest(), channel, used, 1000);
    expect(second).toEqual({ confirmed: false, reason: "already-used" });
  });

  it("a different operation (different parameters) is NOT blocked by a prior approval", async () => {
    const channel = new ScriptedChannel({ kind: "approved" });
    const used = new Set<OperationHash>();
    await confirmOperation(makeRequest({ parameters: { path: "/a" } }), channel, used, 1000);

    const different = await confirmOperation(
      makeRequest({ parameters: { path: "/b" } }),
      channel,
      used,
      1000,
    );
    expect(different.confirmed).toBe(true);
  });

  it("guarantee 4/5: rejected response denies, does not consume the hash for future replay", async () => {
    const channel = new ScriptedChannel({ kind: "rejected" });
    const used = new Set<OperationHash>();
    const result = await confirmOperation(makeRequest(), channel, used, 1000);

    expect(result).toEqual({ confirmed: false, reason: "rejected" });
    expect(used.size).toBe(0);
  });

  it("guarantee 4: timeout denies by default", async () => {
    const channel = new ScriptedChannel({ kind: "timed-out" });
    const used = new Set<OperationHash>();
    const result = await confirmOperation(makeRequest(), channel, used, 1000);

    expect(result).toEqual({ confirmed: false, reason: "timed-out" });
  });

  it("guarantee 3: the channel is shown the real resolved command and host, not raw Core data", async () => {
    const channel = new ScriptedChannel({ kind: "approved" });
    const used = new Set<OperationHash>();
    await confirmOperation(
      makeRequest({
        resolvedCommand: ["systemctl", "restart", "nginx"],
        hostname: "web-1.internal",
      }),
      channel,
      used,
      1000,
    );

    expect(channel.promptsSeen[0]?.resolvedCommand).toEqual(["systemctl", "restart", "nginx"]);
    expect(channel.promptsSeen[0]?.hostname).toBe("web-1.internal");
  });
});
