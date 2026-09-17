import type { OperationHash } from "./operation-hash.js";

/**
 * In-memory, non-persistent registry of operation-hash state (DEC-038, extended by DEC-045).
 * Three states, never surviving a process restart:
 * - absent: never confirmed, never cancelled — a fresh confirmation attempt may proceed.
 * - "used": already consumed by a prior approval (DEC-038 guarantee 2) — a second attempt with
 *   the same hash is refused.
 * - "cancelled": the MCP `tools/call` that would have consumed this confirmation was cancelled
 *   before approval was recorded (DEC-045) — any approval arriving for this hash afterwards is
 *   discarded, even if the human already answered "yes".
 *
 * `markUsedIfNotCancelled` and `markCancelledIfNotUsed` are the only mutation entry points, and
 * both are synchronous, single-tick operations — the race between a cancellation event and an
 * operator's approval is resolved by whichever call reaches this registry first in Node's single
 * event loop, never by wall-clock timing (DEC-045 guarantee 4). Callers MUST NOT `await` between
 * checking a hash's state and calling one of these methods.
 */
export class OperationHashRegistry {
  private readonly state = new Map<OperationHash, "used" | "cancelled">();

  get(hash: OperationHash): "used" | "cancelled" | undefined {
    return this.state.get(hash);
  }

  /** Returns true if the hash was successfully marked used (i.e. was not already cancelled). */
  markUsedIfNotCancelled(hash: OperationHash): boolean {
    if (this.state.get(hash) === "cancelled") {
      return false;
    }
    this.state.set(hash, "used");
    return true;
  }

  /** Returns true if the hash was successfully marked cancelled (i.e. was not already used). */
  markCancelledIfNotUsed(hash: OperationHash): boolean {
    if (this.state.get(hash) === "used") {
      return false;
    }
    this.state.set(hash, "cancelled");
    return true;
  }
}
