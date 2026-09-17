import { readFile } from "node:fs/promises";
import type { SecretId } from "@agentforge/shared";
import type { GithubOperationTemplate } from "./operation-template.js";

/** A configured GitHub account (DEC-039-equivalent for this connector) — own JSON file, separate
 * from Registry/Discovery/Policy Engine. */
export interface GithubAccountEntry {
  readonly accountId: string;
  readonly apiBaseUrl: string;
  /** References the Secrets Broker record holding the PAT (DEC-031, kind "token") — never the
   * token itself. */
  readonly tokenSecretId: SecretId;
}

export interface ConnectorConfig {
  readonly accounts: readonly GithubAccountEntry[];
  /** Operation templates keyed by tool identity (DEC-062). */
  readonly operationTemplates: Readonly<Record<string, GithubOperationTemplate>>;
}

export async function loadConnectorConfig(configFilePath: string): Promise<ConnectorConfig> {
  const raw = await readFile(configFilePath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<ConnectorConfig>;
  return {
    accounts: parsed.accounts ?? [],
    operationTemplates: parsed.operationTemplates ?? {},
  };
}

export function findAccount(
  config: ConnectorConfig,
  accountId: string,
): GithubAccountEntry | undefined {
  return config.accounts.find((account) => account.accountId === accountId);
}
