import { readFile } from "node:fs/promises";
import type { SecretId } from "@agentforge/shared";
import type { CommandTemplate } from "./command-template.js";

/** A configured remote host (DEC-039) — own JSON file, separate from Registry/Discovery/Policy. */
export interface HostEntry {
  readonly hostId: string;
  readonly hostname: string;
  readonly port: number;
  readonly username: string;
  /** References the Secrets Broker record holding the ssh-key (DEC-031) — never the key itself. */
  readonly sshKeySecretId: SecretId;
}

export interface ExecutionConfig {
  readonly hosts: readonly HostEntry[];
  /** Command templates keyed by tool identity (DEC-037). */
  readonly commandTemplates: Readonly<Record<string, CommandTemplate>>;
}

export async function loadExecutionConfig(configFilePath: string): Promise<ExecutionConfig> {
  const raw = await readFile(configFilePath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<ExecutionConfig>;
  return {
    hosts: parsed.hosts ?? [],
    commandTemplates: parsed.commandTemplates ?? {},
  };
}

export function findHost(config: ExecutionConfig, hostId: string): HostEntry | undefined {
  return config.hosts.find((host) => host.hostId === hostId);
}
