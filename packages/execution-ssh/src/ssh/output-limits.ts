/** Truncates captured output (DEC-040). Never logged elsewhere in this package — see grep check
 * in CI/tests: no `console.*` calls exist in this module tree. */
export const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KiB per stream

export interface TruncatedOutput {
  readonly text: string;
  /** Structural flag (Fase 10, DEC-055): whether the limit was exceeded. Determined from the
   * actual byte length, never inferred later by searching output content — avoids both content
   * inspection and false positives if real output happened to contain the truncation marker. */
  readonly truncated: boolean;
}

export function truncateOutput(chunks: readonly Buffer[]): TruncatedOutput {
  const combined = Buffer.concat(chunks);
  if (combined.length <= MAX_OUTPUT_BYTES) {
    return { text: combined.toString("utf-8"), truncated: false };
  }
  return {
    text: combined.subarray(0, MAX_OUTPUT_BYTES).toString("utf-8") + "\n...[truncated]",
    truncated: true,
  };
}
