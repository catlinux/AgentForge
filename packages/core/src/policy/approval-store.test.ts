import { describe, expect, it } from "vitest";
import type { SchemaFingerprint, ToolIdentity } from "@agentforge/shared";
import { InMemoryPolicyApprovalStore } from "./approval-store.js";

describe("InMemoryPolicyApprovalStore", () => {
  it("returns undefined for an identity never approved", async () => {
    const store = new InMemoryPolicyApprovalStore();
    expect(await store.getApprovedFingerprint("unknown" as ToolIdentity)).toBeUndefined();
  });

  it("records and retrieves an approved fingerprint", async () => {
    const store = new InMemoryPolicyApprovalStore();
    const identity = "id-1" as ToolIdentity;
    const fingerprint = "fp-1" as SchemaFingerprint;

    await store.recordApproval(identity, fingerprint);
    expect(await store.getApprovedFingerprint(identity)).toBe(fingerprint);
  });

  it("does not persist across separate store instances (DEC-027: no persistence)", async () => {
    const store1 = new InMemoryPolicyApprovalStore();
    await store1.recordApproval("id-1" as ToolIdentity, "fp-1" as SchemaFingerprint);

    const store2 = new InMemoryPolicyApprovalStore();
    expect(await store2.getApprovedFingerprint("id-1" as ToolIdentity)).toBeUndefined();
  });
});
