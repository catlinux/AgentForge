import { describe, expect, it } from "vitest";
import { generateOperationId } from "./operation-id.js";

describe("generateOperationId (DEC-054)", () => {
  it("generates a non-empty string", () => {
    const id = generateOperationId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("generates a fresh id on every call (never reused across invocations)", () => {
    const a = generateOperationId();
    const b = generateOperationId();
    expect(a).not.toBe(b);
  });
});
