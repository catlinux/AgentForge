import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { SecretId, SecretKind, SecretMetadataView, SecretRecord } from "@agentforge/shared";
import { decrypt, encrypt, type EncryptedPayload } from "./crypto.js";

interface OnDiskFile {
  readonly records: Readonly<Record<string, EncryptedPayload>>;
}

/**
 * File-backed encrypted secret store (DEC-030). Each `SecretRecord` is serialized to JSON and
 * encrypted as a whole (payload + metadata) before being written — the on-disk file never
 * contains any plaintext secret material. `SecretId` values themselves are not secret and are
 * kept as plaintext map keys (needed to look records up), consistent with DEC-034: identity is
 * opaque but not itself sensitive.
 */
export class SecretStore {
  constructor(
    private readonly filePath: string,
    private readonly masterKey: Buffer,
  ) {}

  async get(id: SecretId): Promise<SecretRecord | undefined> {
    const file = await this.readFile();
    const encrypted = file.records[id];
    if (encrypted === undefined) {
      return undefined;
    }
    return this.decryptRecord(encrypted);
  }

  async exists(id: SecretId): Promise<boolean> {
    const file = await this.readFile();
    return id in file.records;
  }

  async create(
    kind: SecretKind,
    payload: Record<string, string>,
    provider: string | undefined,
    label: string,
  ): Promise<SecretId> {
    const id = randomUUID() as SecretId;
    const now = new Date().toISOString();
    const record: SecretRecord = {
      id,
      kind,
      payload,
      metadata: { provider, label, createdAt: now, updatedAt: now },
    };
    await this.writeRecord(record);
    return id;
  }

  async update(id: SecretId, payload: Record<string, string>): Promise<void> {
    const existing = await this.get(id);
    if (existing === undefined) {
      throw new Error("Secret not found");
    }
    const updated: SecretRecord = {
      ...existing,
      payload,
      metadata: { ...existing.metadata, updatedAt: new Date().toISOString() },
    };
    await this.writeRecord(updated);
  }

  async delete(id: SecretId): Promise<void> {
    const file = await this.readFile();
    if (!(id in file.records)) {
      return;
    }
    const rest: Record<string, EncryptedPayload> = { ...file.records };
    delete rest[id];
    await this.persist({ records: rest });
  }

  async listMetadata(): Promise<readonly SecretMetadataView[]> {
    const file = await this.readFile();
    const views: SecretMetadataView[] = [];
    for (const encrypted of Object.values(file.records)) {
      const record = this.decryptRecord(encrypted);
      views.push({ id: record.id, kind: record.kind, metadata: record.metadata });
    }
    return views;
  }

  private decryptRecord(encrypted: EncryptedPayload): SecretRecord {
    const plaintext = decrypt(encrypted, this.masterKey);
    return JSON.parse(plaintext.toString("utf-8")) as SecretRecord;
  }

  private async writeRecord(record: SecretRecord): Promise<void> {
    const file = await this.readFile();
    const plaintext = Buffer.from(JSON.stringify(record), "utf-8");
    const encrypted = encrypt(plaintext, this.masterKey);
    await this.persist({ records: { ...file.records, [record.id]: encrypted } });
  }

  private async readFile(): Promise<OnDiskFile> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as OnDiskFile;
      if (typeof parsed !== "object" || parsed === null || typeof parsed.records !== "object") {
        throw new Error("Secrets file is corrupted: unexpected structure");
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { records: {} };
      }
      if (error instanceof SyntaxError) {
        throw new Error("Secrets file is corrupted: invalid JSON");
      }
      throw error;
    }
  }

  private async persist(file: OnDiskFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(file, null, 2), { mode: 0o600 });
  }
}
