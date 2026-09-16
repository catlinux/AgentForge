import type { SecretId } from "./identity.js";

/**
 * Secret kinds (DEC-031). Adding a new kind is a `payload` key convention, not a schema
 * migration — deliberately not one TypeScript class per kind.
 */
export type SecretKind = "api-key" | "token" | "credential" | "ssh-key" | "generic";

/**
 * A secret record (DEC-031). `payload` shape by `kind` (documented convention, not enforced by
 * distinct types):
 * - "api-key"   -> { value }
 * - "token"     -> { value, expiresAt? }
 * - "credential"-> { username, password }
 * - "ssh-key"   -> { privateKey, passphrase? }
 * - "generic"   -> { value }
 */
export interface SecretRecord {
  readonly id: SecretId;
  readonly kind: SecretKind;
  readonly payload: Readonly<Record<string, string>>;
  readonly metadata: SecretMetadata;
}

export interface SecretMetadata {
  readonly provider: string | undefined;
  readonly label: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Metadata-only projection (DEC-033 `listMetadata`) — never includes `payload`. */
export type SecretMetadataView = Pick<SecretRecord, "id" | "kind" | "metadata">;
