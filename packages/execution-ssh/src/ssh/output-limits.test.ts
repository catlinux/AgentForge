import { describe, expect, it } from "vitest";
import { MAX_OUTPUT_BYTES, truncateOutput } from "./output-limits.js";

describe("truncateOutput (DEC-040, DEC-055 structural truncated flag)", () => {
  it("returns short output unchanged, truncated:false", () => {
    const result = truncateOutput([Buffer.from("hello")]);
    expect(result.text).toBe("hello");
    expect(result.truncated).toBe(false);
  });

  it("truncates output exceeding the limit and sets truncated:true", () => {
    const big = Buffer.alloc(MAX_OUTPUT_BYTES + 100, "x");
    const result = truncateOutput([big]);
    expect(result.text.length).toBeLessThan(big.length);
    expect(result.text).toContain("[truncated]");
    expect(result.truncated).toBe(true);
  });

  it("never exceeds the configured byte limit plus the truncation marker", () => {
    const big = Buffer.alloc(MAX_OUTPUT_BYTES * 3, "y");
    const result = truncateOutput([big]);
    const truncatedPortionBytes = Buffer.byteLength(
      result.text.replace("\n...[truncated]", ""),
      "utf-8",
    );
    expect(truncatedPortionBytes).toBeLessThanOrEqual(MAX_OUTPUT_BYTES);
  });

  it("concatenates multiple chunks before truncating", () => {
    const result = truncateOutput([Buffer.from("ab"), Buffer.from("cd")]);
    expect(result.text).toBe("abcd");
    expect(result.truncated).toBe(false);
  });

  it("truncated flag reflects actual byte length, never derived from content inspection", () => {
    // A short output that happens to literally contain the truncation marker text must NOT be
    // reported as truncated — the flag comes from length comparison, not string search.
    const suspicious = Buffer.from("short output that mentions [truncated] in its own text");
    const result = truncateOutput([suspicious]);
    expect(result.truncated).toBe(false);
  });
});
