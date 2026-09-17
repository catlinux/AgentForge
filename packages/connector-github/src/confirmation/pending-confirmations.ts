import type { OperationHash } from "./operation-hash.js";

/**
 * In-memory, non-persistent tracker of confirmations currently in flight (Fase 10) — same
 * construction as `execution-ssh/src/confirmation/pending-confirmations.ts` (see
 * operation-hash.ts in this package for why it is duplicated rather than shared). Deliberately
 * separate from `OperationHashRegistry` (DEC-038/DEC-045): never participates in any authorization
 * or execution decision (DEC-056 isolation), exists solely so the audit layer (DEC-054) can tell a
 * genuinely-pending cancellation apart from one with nothing to cancel.
 *
 * `add`/`remove` are synchronous, called immediately before/after the single `await` in
 * `confirmOperation()` — entries never outlive that one `await`, and are always removed via a
 * `finally`, regardless of how the confirmation resolves.
 */
export class PendingConfirmations {
  private readonly pending = new Set<OperationHash>();

  add(hash: OperationHash): void {
    this.pending.add(hash);
  }

  remove(hash: OperationHash): void {
    this.pending.delete(hash);
  }

  has(hash: OperationHash): boolean {
    return this.pending.has(hash);
  }
}
