import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12; // 96-bit nonce, the recommended size for GCM
const AUTH_TAG_LENGTH_BYTES = 16;

export interface EncryptedPayload {
  /** Base64-encoded 96-bit nonce. Freshly generated per encryption — never reused with the key. */
  readonly iv: string;
  /** Base64-encoded GCM authentication tag, kept separate from ciphertext (DEC-030 review). */
  readonly authTag: string;
  readonly ciphertext: string;
}

/**
 * AES-256-GCM encryption (DEC-030). A fresh random IV/nonce is generated per call — this
 * function never accepts a caller-supplied IV, so reuse is structurally impossible.
 */
export function encrypt(plaintext: Buffer, key: Buffer): EncryptedPayload {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH_BYTES} bytes`);
  }
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

/**
 * AES-256-GCM decryption. Throws if the authentication tag does not match — this is the only
 * signal returned; the error message never includes any plaintext or key material.
 */
export function decrypt(payload: EncryptedPayload, key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH_BYTES} bytes`);
  }
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH_BYTES });
  decipher.setAuthTag(authTag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // Never leak plaintext, key material, or the underlying crypto error details.
    throw new Error("Decryption failed: ciphertext or key is invalid or corrupted");
  }
}

export function generateKey(): Buffer {
  return randomBytes(KEY_LENGTH_BYTES);
}

export const SECRET_KEY_LENGTH_BYTES = KEY_LENGTH_BYTES;
