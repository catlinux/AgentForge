import type { SecretsBrokerOperation, SecretsBrokerResult } from "@agentforge/shared";
import type { SecretStore } from "../storage/secret-store.js";

const VALID_KINDS = new Set(["api-key", "token", "credential", "ssh-key", "generic"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Handles a single Secrets Broker operation (DEC-033 API). Per DEC-034, no binding against a
 * caller-declared origin/identity is checked here — any request arriving over the authenticated
 * IPC channel (DEC-010) is treated as coming from the legitimate Core process. Per DEC-036, no
 * authorization evidence is validated either; see DECISIONS.md for the documented limitation.
 *
 * Error messages never include secret payload values, master key material, or raw underlying
 * crypto error details (see storage/crypto.ts).
 */
export async function handleOperation(
  store: SecretStore,
  operation: SecretsBrokerOperation,
): Promise<SecretsBrokerResult> {
  try {
    switch (operation.type) {
      case "get": {
        const record = await store.get(operation.id);
        if (record === undefined) {
          return { ok: false, error: "Secret not found" };
        }
        return { ok: true, type: "get", record };
      }
      case "create": {
        if (!VALID_KINDS.has(operation.kind)) {
          return { ok: false, error: "Invalid secret kind" };
        }
        if (!isNonEmptyString(operation.label)) {
          return { ok: false, error: "Label is required" };
        }
        if (
          typeof operation.payload !== "object" ||
          operation.payload === null ||
          Object.keys(operation.payload).length === 0
        ) {
          return { ok: false, error: "Payload must be a non-empty object" };
        }
        const id = await store.create(
          operation.kind,
          operation.payload,
          operation.provider,
          operation.label,
        );
        return { ok: true, type: "create", id };
      }
      case "update": {
        if (
          typeof operation.payload !== "object" ||
          operation.payload === null ||
          Object.keys(operation.payload).length === 0
        ) {
          return { ok: false, error: "Payload must be a non-empty object" };
        }
        await store.update(operation.id, operation.payload);
        return { ok: true, type: "update" };
      }
      case "delete": {
        await store.delete(operation.id);
        return { ok: true, type: "delete" };
      }
      case "exists": {
        const exists = await store.exists(operation.id);
        return { ok: true, type: "exists", exists };
      }
      case "list-metadata": {
        const items = await store.listMetadata();
        return { ok: true, type: "list-metadata", items };
      }
    }
  } catch {
    // Never surface the underlying error message to the caller — it could describe file paths,
    // corruption details, or (in principle) crypto internals. Log-free by design (DEC-027/§1):
    // this function does not log either.
    return { ok: false, error: "Secrets Broker operation failed" };
  }
}
