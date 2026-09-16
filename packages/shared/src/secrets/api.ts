import type { SecretId } from "./identity.js";
import type { SecretKind, SecretMetadataView, SecretRecord } from "./record.js";

/** Minimal, justified operation set (DEC-033) — no rotation, no historical versioning. */
export type SecretsBrokerOperation =
  | { readonly type: "get"; readonly id: SecretId }
  | {
      readonly type: "create";
      readonly kind: SecretKind;
      readonly payload: Record<string, string>;
      readonly provider: string | undefined;
      readonly label: string;
    }
  | {
      readonly type: "update";
      readonly id: SecretId;
      readonly payload: Record<string, string>;
    }
  | { readonly type: "delete"; readonly id: SecretId }
  | { readonly type: "exists"; readonly id: SecretId }
  | { readonly type: "list-metadata" };

export type SecretsBrokerResult =
  | { readonly ok: true; readonly type: "get"; readonly record: SecretRecord }
  | { readonly ok: true; readonly type: "create"; readonly id: SecretId }
  | { readonly ok: true; readonly type: "update" }
  | { readonly ok: true; readonly type: "delete" }
  | { readonly ok: true; readonly type: "exists"; readonly exists: boolean }
  | {
      readonly ok: true;
      readonly type: "list-metadata";
      readonly items: readonly SecretMetadataView[];
    }
  | { readonly ok: false; readonly error: string };
