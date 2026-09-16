import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateKey, SECRET_KEY_LENGTH_BYTES } from "./crypto.js";

/**
 * Master key management (DEC-032). The key lives in its own file, separate from the encrypted
 * secrets file, with OS permissions restricted to the Broker's own user. Unattended startup: no
 * human passphrase is required at process start, on this phase's scope. Losing this file makes
 * the encrypted secrets file unrecoverable by design — there is no backdoor.
 */
export class MasterKeyStore {
  constructor(private readonly keyFilePath: string) {}

  /** Loads the key, generating and persisting a new one on first use. */
  async loadOrCreate(): Promise<Buffer> {
    try {
      const raw = await readFile(this.keyFilePath);
      if (raw.length !== SECRET_KEY_LENGTH_BYTES) {
        throw new Error("Master key file is corrupted: unexpected length");
      }
      return raw;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return this.createAndPersist();
      }
      throw error;
    }
  }

  private async createAndPersist(): Promise<Buffer> {
    const key = generateKey();
    await mkdir(dirname(this.keyFilePath), { recursive: true });
    // mode 0o600: readable/writable only by the owning OS user (the Broker's own account,
    // DEC-004) — POSIX permission bits; on Windows this narrows to the file owner via the ACL
    // Node applies, though the primary boundary there is the distinct OS account per DEC-004.
    await writeFile(this.keyFilePath, key, { mode: 0o600 });
    return key;
  }
}

/** Verifies the on-disk key file still has restrictive permissions — a defense-in-depth check. */
export async function assertRestrictivePermissions(keyFilePath: string): Promise<void> {
  const stats = await stat(keyFilePath);
  const mode = stats.mode & 0o777;
  if (mode & 0o077) {
    throw new Error("Master key file has overly permissive access — refusing to proceed");
  }
}
