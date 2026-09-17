import type { SecretId } from "./identity.js";
import type { SecretRecord } from "./record.js";
import type { ExecutionSecretsChannelClient } from "./execution-secrets-channel.js";

/**
 * Builds a real "resolve a host/account id to its secret" function (the shape both
 * `execution-ssh`'s `getSshKeySecret` and `connector-github`'s `getTokenSecret` already expect)
 * backed by a real `ExecutionSecretsChannelClient` (Fase 13, DEC-F) instead of a mocked stub.
 * Shared here rather than duplicated per backend — this glue carries no backend-specific security
 * state (unlike the confirmation machinery, DEC-058, which Fase 11 deliberately duplicated).
 *
 * `resolveSecretId` maps the caller's own id space (hostId, accountId, ...) to a `SecretId` using
 * that backend's own declarative configuration — this function never invents that mapping itself.
 * Fail-closed: any missing mapping, connection failure, or channel error resolves to `undefined`,
 * exactly like the existing mocked stubs already did on any lookup miss.
 */
export function makeChannelBackedSecretResolver(
  channel: ExecutionSecretsChannelClient,
  resolveSecretId: (callerId: string) => SecretId | undefined,
): (callerId: string) => Promise<SecretRecord | undefined> {
  return async (callerId: string): Promise<SecretRecord | undefined> => {
    const secretId = resolveSecretId(callerId);
    if (secretId === undefined) return undefined;
    const response = await channel.get(secretId);
    return response.ok ? response.record : undefined;
  };
}
