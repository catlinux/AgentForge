/**
 * Result of an execution attempt (Fase 7). `stdout`/`stderr` are already truncated per DEC-040
 * before this type is constructed — this type itself carries no obligation to truncate, that is
 * the producer's responsibility (see execution-ssh/src/ssh/output-limits.ts).
 *
 * `stdoutTruncated`/`stderrTruncated` (Fase 10, DEC-055) are a minimal structural extension of
 * this contract: they expose, as booleans, a fact (`truncated`) already computed at the point of
 * truncation — not a change to Fase 7's truncation policy, limits, or SSH behavior. Added so the
 * Audit Log can record whether truncation occurred without inspecting or storing any stdout/
 * stderr content.
 */
export type ExecutionOutcome =
  | {
      readonly kind: "executed";
      readonly exitCode: number;
      readonly stdout: string;
      readonly stderr: string;
      readonly stdoutTruncated: boolean;
      readonly stderrTruncated: boolean;
    }
  | { readonly kind: "denied"; readonly reason: string }
  | { readonly kind: "confirmation-required-but-missing"; readonly reason: string }
  | { readonly kind: "timed-out" }
  | { readonly kind: "failed"; readonly reason: string };
