import { describe, expect, it } from "vitest";
import type { SecretId } from "./identity.js";
import type { SecretRecord } from "./record.js";
import type { ExecutionSecretsChannelClient } from "./execution-secrets-channel.js";
import { makeChannelBackedSecretResolver } from "./resolve-via-channel.js";

const record: SecretRecord = {
  id: "secret-1" as SecretId,
  kind: "ssh-key",
  payload: { privateKey: "fake" },
  metadata: { provider: undefined, label: "t", createdAt: "now", updatedAt: "now" },
};

describe("makeChannelBackedSecretResolver (Fase 13, DEC-F)", () => {
  it("resolves the caller id to a SecretId, then fetches it over the channel", async () => {
    const channel: ExecutionSecretsChannelClient = {
      connect: async () => {},
      get: async (id) => (id === "secret-1" ? { ok: true, record } : { ok: false, reason: "no" }),
      close: async () => {},
    };
    const resolver = makeChannelBackedSecretResolver(channel, (hostId) =>
      hostId === "host-1" ? ("secret-1" as SecretId) : undefined,
    );

    expect(await resolver("host-1")).toEqual(record);
  });

  it("returns undefined without calling the channel when the id cannot be resolved", async () => {
    let called = false;
    const channel: ExecutionSecretsChannelClient = {
      connect: async () => {},
      get: async () => {
        called = true;
        return { ok: false, reason: "should not be called" };
      },
      close: async () => {},
    };
    const resolver = makeChannelBackedSecretResolver(channel, () => undefined);

    expect(await resolver("unknown-host")).toBeUndefined();
    expect(called).toBe(false);
  });

  it("returns undefined when the channel itself fails", async () => {
    const channel: ExecutionSecretsChannelClient = {
      connect: async () => {},
      get: async () => ({ ok: false, reason: "Secret not found" }),
      close: async () => {},
    };
    const resolver = makeChannelBackedSecretResolver(channel, () => "secret-1" as SecretId);

    expect(await resolver("host-1")).toBeUndefined();
  });
});
