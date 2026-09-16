/**
 * Result of an execution attempt (Fase 7). `stdout`/`stderr` are already truncated per DEC-040
 * before this type is constructed — this type itself carries no obligation to truncate, that is
 * the producer's responsibility (see execution-ssh/src/ssh/output-limits.ts).
 */
export type ExecutionOutcome =
  | {
      readonly kind: "executed";
      readonly exitCode: number;
      readonly stdout: string;
      readonly stderr: string;
    }
  | { readonly kind: "denied"; readonly reason: string }
  | { readonly kind: "confirmation-required-but-missing"; readonly reason: string }
  | { readonly kind: "timed-out" }
  | { readonly kind: "failed"; readonly reason: string };
