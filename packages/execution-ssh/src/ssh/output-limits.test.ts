import { describe, expect, it } from "vitest";
import { MAX_OUTPUT_BYTES, truncateOutput } from "./output-limits.js";

describe("truncateOutput (DEC-040)", () => {
  it("returns short output unchanged", () => {
    expect(truncateOutput([Buffer.from("hello")])).toBe("hello");
  });

  it("truncates output exceeding the limit and marks it as truncated", () => {
    const big = Buffer.alloc(MAX_OUTPUT_BYTES + 100, "x");
    const result = truncateOutput([big]);
    expect(result.length).toBeLessThan(big.length);
    expect(result).toContain("[truncated]");
  });

  it("never exceeds the configured byte limit plus the truncation marker", () => {
    const big = Buffer.alloc(MAX_OUTPUT_BYTES * 3, "y");
    const result = truncateOutput([big]);
    const truncatedPortionBytes = Buffer.byteLength(
      result.replace("\n...[truncated]", ""),
      "utf-8",
    );
    expect(truncatedPortionBytes).toBeLessThanOrEqual(MAX_OUTPUT_BYTES);
  });

  it("concatenates multiple chunks before truncating", () => {
    const result = truncateOutput([Buffer.from("ab"), Buffer.from("cd")]);
    expect(result).toBe("abcd");
  });
});
