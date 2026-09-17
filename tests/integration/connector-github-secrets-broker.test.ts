import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { PolicyDecision, SchemaFingerprint, ToolIdentity } from "@agentforge/shared";
import { generateKey } from "@agentforge/secrets-broker/dist/storage/crypto.js";
import { SecretStore } from "@agentforge/secrets-broker/dist/storage/secret-store.js";
import { NetExecutionChannelClient } from "@agentforge/mcp-server";
import { startMockGithubServer, type MockGithubServer } from "./helpers/mock-github-server.js";
import { spawnTestProcess, type SpawnedProcess } from "./helpers/spawn-process.js";

const helpersDir = dirname(fileURLToPath(import.meta.url)) + "/helpers";

function executionChannelSocketPath(): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return platform() === "win32"
    ? `\\\\.\\pipe\\agentforge-it-connector-${suffix}`
    : join(tmpdir(), `agentforge-it-connector-${suffix}.sock`);
}

/**
 * Real, cross-process integration test (Fase 14, DEC-072) for the GitHub connector — mirrors
 * `execution-ssh-secrets-broker.test.ts` but for `connector-github`: a real Secrets Broker
 * process, a real connector-github process using its own real default Secrets Broker channel
 * client (DEC-070/065), a real local HTTP server standing in for the GitHub API (never the real
 * one), and a real `NetExecutionChannelClient` (DEC-047) driving the whole thing.
 */
describe("connector-github <-> Secrets Broker, end to end across real processes", () => {
  let dataDir: string;
  let githubServer: MockGithubServer | undefined;
  let secretsBrokerProcess: SpawnedProcess | undefined;
  let connectorProcess: SpawnedProcess | undefined;
  let executionClient: NetExecutionChannelClient | undefined;

  afterEach(async () => {
    await executionClient?.close();
    await connectorProcess?.close();
    await secretsBrokerProcess?.close();
    await githubServer?.close();
    if (dataDir !== undefined) await rm(dataDir, { recursive: true, force: true });
  });

  it("runs a real tools/call through the GitHub connector and the Secrets Broker, over real IPC channels, against a real local HTTP server", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "agentforge-it-"));
    const secretsFilePath = join(dataDir, "secrets.json");
    const masterKey = generateKey();

    githubServer = await startMockGithubServer();

    const seedStore = new SecretStore(secretsFilePath, masterKey);
    const tokenSecretId = await seedStore.create(
      "token",
      { value: "ghp_integration-test-fake-token" },
      "github",
      "integration test PAT",
    );

    secretsBrokerProcess = await spawnTestProcess(join(helpersDir, "secrets-broker-process.mjs"), [
      secretsFilePath,
      masterKey.toString("base64"),
    ]);

    const toolIdentity = "integration-github-tool-1" as ToolIdentity;
    const accountId = "integration-account-1";
    const executionSocketPath = executionChannelSocketPath();

    connectorProcess = await spawnTestProcess(join(helpersDir, "connector-github-process.mjs"), [
      executionSocketPath,
      accountId,
      githubServer.baseUrl,
      tokenSecretId,
      toolIdentity,
    ]);

    executionClient = new NetExecutionChannelClient(executionSocketPath);
    await executionClient.connect();

    const decision: PolicyDecision = {
      verdict: "allow",
      ruleApplied: "risk-default",
      baseRisk: "reversible-write",
      identity: toolIdentity,
      schemaFingerprint: "fp-integration-test" as SchemaFingerprint,
    };

    const response = await executionClient.request({
      identity: toolIdentity,
      hostId: accountId,
      parameters: { owner: "integration-owner", repo: "integration-repo", title: "test issue" },
      decision,
      sessionId: randomUUID(),
      operationId: randomUUID(),
    } as never);

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.outcome.kind).toBe("executed-http");
      if (response.outcome.kind === "executed-http") {
        expect(response.outcome.statusCode).toBe(201);
      }
    }

    // Proves the real PAT (fetched over the real Secrets Broker channel, DEC-070) reached the
    // real HTTP request — never a hardcoded/mocked value inside connector-github itself.
    expect(githubServer.receivedAuthorizationHeaders).toContain(
      "Bearer ghp_integration-test-fake-token",
    );
  });

  it("fails closed when the Secrets Broker process is not running", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "agentforge-it-"));
    githubServer = await startMockGithubServer();

    const toolIdentity = "integration-github-tool-2" as ToolIdentity;
    const accountId = "integration-account-2";
    const executionSocketPath = executionChannelSocketPath();

    connectorProcess = await spawnTestProcess(join(helpersDir, "connector-github-process.mjs"), [
      executionSocketPath,
      accountId,
      githubServer.baseUrl,
      "nonexistent-secret-id",
      toolIdentity,
    ]);

    executionClient = new NetExecutionChannelClient(executionSocketPath);
    await executionClient.connect();

    const decision: PolicyDecision = {
      verdict: "allow",
      ruleApplied: "risk-default",
      baseRisk: "reversible-write",
      identity: toolIdentity,
      schemaFingerprint: "fp-integration-test" as SchemaFingerprint,
    };

    const response = await executionClient.request({
      identity: toolIdentity,
      hostId: accountId,
      parameters: { owner: "integration-owner", repo: "integration-repo", title: "test issue" },
      decision,
      sessionId: randomUUID(),
      operationId: randomUUID(),
    } as never);

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.outcome.kind).toBe("failed");
    }
    expect(githubServer.receivedAuthorizationHeaders).toHaveLength(0);
  });
});
