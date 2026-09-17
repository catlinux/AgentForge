import { describe, expect, it } from "vitest";
import type { OperationHash } from "./operation-hash.js";
import { PendingConfirmations } from "./pending-confirmations.js";

const hash = "h-1" as OperationHash;

describe("PendingConfirmations (Fase 10 — audit-only, never authorization)", () => {
  it("a fresh hash is not pending", () => {
    const pending = new PendingConfirmations();
    expect(pending.has(hash)).toBe(false);
  });

  it("add() marks a hash pending; remove() clears it", () => {
    const pending = new PendingConfirmations();
    pending.add(hash);
    expect(pending.has(hash)).toBe(true);

    pending.remove(hash);
    expect(pending.has(hash)).toBe(false);
  });

  it("removing a hash that was never added is a no-op", () => {
    const pending = new PendingConfirmations();
    expect(() => pending.remove(hash)).not.toThrow();
    expect(pending.has(hash)).toBe(false);
  });

  it("state does not persist across separate instances (no persistence, same as OperationHashRegistry)", () => {
    const pending1 = new PendingConfirmations();
    pending1.add(hash);

    const pending2 = new PendingConfirmations();
    expect(pending2.has(hash)).toBe(false);
  });
});
