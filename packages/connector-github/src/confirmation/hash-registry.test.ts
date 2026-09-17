import { describe, expect, it } from "vitest";
import type { OperationHash } from "./operation-hash.js";
import { OperationHashRegistry } from "./hash-registry.js";

const hash = "h-1" as OperationHash;

describe("OperationHashRegistry (DEC-045)", () => {
  it("a fresh hash has no recorded state", () => {
    const registry = new OperationHashRegistry();
    expect(registry.get(hash)).toBeUndefined();
  });

  it("marks a fresh hash as used", () => {
    const registry = new OperationHashRegistry();
    expect(registry.markUsedIfNotCancelled(hash)).toBe(true);
    expect(registry.get(hash)).toBe("used");
  });

  it("marks a fresh hash as cancelled", () => {
    const registry = new OperationHashRegistry();
    expect(registry.markCancelledIfNotUsed(hash)).toBe(true);
    expect(registry.get(hash)).toBe("cancelled");
  });

  it("cannot mark a cancelled hash as used", () => {
    const registry = new OperationHashRegistry();
    registry.markCancelledIfNotUsed(hash);
    expect(registry.markUsedIfNotCancelled(hash)).toBe(false);
    expect(registry.get(hash)).toBe("cancelled");
  });

  it("cannot mark a used hash as cancelled", () => {
    const registry = new OperationHashRegistry();
    registry.markUsedIfNotCancelled(hash);
    expect(registry.markCancelledIfNotUsed(hash)).toBe(false);
    expect(registry.get(hash)).toBe("used");
  });

  it("state does not persist across separate registry instances (DEC-027/DEC-038: no persistence)", () => {
    const registry1 = new OperationHashRegistry();
    registry1.markUsedIfNotCancelled(hash);

    const registry2 = new OperationHashRegistry();
    expect(registry2.get(hash)).toBeUndefined();
  });
});
