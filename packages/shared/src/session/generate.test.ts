import { describe, expect, it } from "vitest";
import { generateSessionId } from "./generate.js";

describe("generateSessionId (DEC-050)", () => {
  it("generates a non-empty string", () => {
    const id = generateSessionId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("generates a fresh id on every call (never reused across generations)", () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
  });
});
