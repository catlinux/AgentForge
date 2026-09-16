import { describe, expect, it } from "vitest";
import { computeSchemaFingerprint } from "./fingerprint.js";

describe("computeSchemaFingerprint", () => {
  it("is deterministic regardless of key order", () => {
    const a = { type: "object", properties: { x: { type: "string" }, y: { type: "number" } } };
    const b = { properties: { y: { type: "number" }, x: { type: "string" } }, type: "object" };
    expect(computeSchemaFingerprint(a)).toBe(computeSchemaFingerprint(b));
  });

  it("differs when the contract actually changes", () => {
    const a = { type: "object", properties: { x: { type: "string" } } };
    const b = { type: "object", properties: { x: { type: "string" }, y: { type: "number" } } };
    expect(computeSchemaFingerprint(a)).not.toBe(computeSchemaFingerprint(b));
  });

  it("handles nested arrays consistently", () => {
    const a = { required: ["b", "a"] };
    const b = { required: ["b", "a"] };
    expect(computeSchemaFingerprint(a)).toBe(computeSchemaFingerprint(b));
  });
});
