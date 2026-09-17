/** Truncates captured output (DEC-040). Never logged elsewhere in this package — see grep check
 * in CI/tests: no `console.*` calls exist in this module tree. */
export const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KiB per stream

export interface TruncatedOutput {
  readonly text: string;
  /** Structural flag (Fase 10, DEC-055): whether the limit was exceeded. Determined from the
   * actual byte length, never inferred later by searching output content — avoids both content
   * inspection and false positives if real output happened to contain the truncation marker. */
  readonly truncated: boolean;
  /** Total bytes received from the SSH stream before truncation (Fase 10, DEC-055) — computed
   * here, from the concatenated chunks, never derived later from the (possibly already-truncated)
   * `text`. This is "bytes received by this process up to the stream's close event", not an
   * absolute guarantee of what the remote command produced in every edge case (e.g. a connection
   * dropped mid-stream) — but it is never underestimated by post-truncation inference. */
  readonly totalBytes: number;
}

export function truncateOutput(chunks: readonly Buffer[]): TruncatedOutput {
  const combined = Buffer.concat(chunks);
  if (combined.length <= MAX_OUTPUT_BYTES) {
    return { text: combined.toString("utf-8"), truncated: false, totalBytes: combined.length };
  }
  return {
    text: combined.subarray(0, MAX_OUTPUT_BYTES).toString("utf-8") + "\n...[truncated]",
    truncated: true,
    totalBytes: combined.length,
  };
}
