/** Truncates captured output (DEC-040). Never logged elsewhere in this package — see grep check
 * in CI/tests: no `console.*` calls exist in this module tree. */
export const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KiB per stream

export function truncateOutput(chunks: readonly Buffer[]): string {
  const combined = Buffer.concat(chunks);
  if (combined.length <= MAX_OUTPUT_BYTES) {
    return combined.toString("utf-8");
  }
  return combined.subarray(0, MAX_OUTPUT_BYTES).toString("utf-8") + "\n...[truncated]";
}
