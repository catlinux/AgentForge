import { describe, expect, it } from "vitest";
import { decrypt, encrypt, generateKey } from "./crypto.js";

describe("AES-256-GCM encrypt/decrypt (DEC-030)", () => {
  it("round-trips plaintext correctly", () => {
    const key = generateKey();
    const plaintext = Buffer.from("super-secret-value", "utf-8");
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted.toString("utf-8")).toBe("super-secret-value");
  });

  it("generates a fresh nonce (iv) on every call, never reused", () => {
    const key = generateKey();
    const plaintext = Buffer.from("same plaintext", "utf-8");
    const first = encrypt(plaintext, key);
    const second = encrypt(plaintext, key);
    expect(first.iv).not.toBe(second.iv);
  });

  it("keeps the auth tag separate from the ciphertext", () => {
    const key = generateKey();
    const encrypted = encrypt(Buffer.from("x"), key);
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.authTag).not.toBe(encrypted.ciphertext);
  });

  it("fails decryption if the ciphertext is tampered with (auth tag mismatch)", () => {
    const key = generateKey();
    const encrypted = encrypt(Buffer.from("original"), key);
    const tampered = { ...encrypted, ciphertext: Buffer.from("tampered!!").toString("base64") };
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it("fails decryption with the wrong key, without leaking plaintext in the error", () => {
    const key = generateKey();
    const wrongKey = generateKey();
    const encrypted = encrypt(Buffer.from("secret-value"), key);
    try {
      decrypt(encrypted, wrongKey);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("secret-value");
      expect((error as Error).message).toMatchInlineSnapshot(
        `"Decryption failed: ciphertext or key is invalid or corrupted"`,
      );
    }
  });

  it("rejects a key of the wrong length", () => {
    const shortKey = Buffer.alloc(16);
    expect(() => encrypt(Buffer.from("x"), shortKey)).toThrow(/Invalid key length/);
  });
});
