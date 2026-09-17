import type { OperationHash } from "./operation-hash.js";

/**
 * In-memory, non-persistent tracker of confirmations currently in flight — i.e. between
 * `confirmOperation()` calling `channel.requestConfirmation()` and that call resolving (Fase 10).
 *
 * Deliberately separate from `OperationHashRegistry` (DEC-038/DEC-045), which only knows terminal
 * states ("used"/"cancelled") and never an in-flight one — that registry's three-state model is a
 * security guarantee already approved and must not be reopened to accommodate this. This tracker
 * has a single responsibility and consumer: letting the audit layer (DEC-054) distinguish "a
 * cancel message arrived while a confirmation was genuinely pending" from "a cancel message
 * arrived for an operation that never required confirmation, or already had a terminal outcome" —
 * it never participates in any authorization or execution decision (DEC-056 isolation).
 *
 * `add`/`remove` are synchronous, called immediately before/after the single `await` in
 * `confirmOperation()` — entries never outlive that one `await`, and are always removed via a
 * `finally`, regardless of how the confirmation resolves (approved, rejected, timed-out, or the
 * channel throwing).
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
