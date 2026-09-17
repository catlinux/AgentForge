import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { PolicyDecision, SchemaFingerprint, SecretId, ToolIdentity } from "@agentforge/shared";
import { generateKey } from "@agentforge/secrets-broker/dist/storage/crypto.js";
import { SecretStore } from "@agentforge/secrets-broker/dist/storage/secret-store.js";
import { NetExecutionChannelClient } from "@agentforge/mcp-server";
import { startMockSshServer, type MockSshServer } from "./helpers/mock-ssh-server.js";
import { spawnTestProcess, type SpawnedProcess } from "./helpers/spawn-process.js";

const helpersDir = dirname(fileURLToPath(import.meta.url)) + "/helpers";

function executionChannelSocketPath(): string {
  // A fresh, unique path per test run — this is the MCP-server<->Execution channel (DEC-047),
  // deliberately NOT the fixed Execution<->Secrets Broker one (that one must stay fixed so
  // execution-ssh's own default client, DEC-070, finds it — see secrets-broker-process.mjs).
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return platform() === "win32"
    ? `\\\\.\\pipe\\agentforge-it-exec-${suffix}`
    : join(tmpdir(), `agentforge-it-exec-${suffix}.sock`);
}

/**
 * Real, cross-process integration test (Fase 14, DEC-072): a real Secrets Broker process
 * (DEC-004), a real execution-ssh process (DEC-042) using its own real default Secrets Broker
 * channel client (DEC-070/065, never an injected mock), a real local SSH server (`ssh2.Server`,
 * loopback only — never a remote host), and a real `NetExecutionChannelClient` (DEC-047) driving
 * the whole thing exactly as the MCP server would. Every unit test in `packages/*` already
 * verifies each of these pieces in isolation with mocks; this test's entire purpose is to prove
 * they still work when actually wired together as separate OS processes.
 */
describe("execution-ssh <-> Secrets Broker, end to end across real processes", () => {
  let dataDir: string;
  let sshServer: MockSshServer | undefined;
  let secretsBrokerProcess: SpawnedProcess | undefined;
  let executionProcess: SpawnedProcess | undefined;
  let executionClient: NetExecutionChannelClient | undefined;

  afterEach(async () => {
    await executionClient?.close();
    await executionProcess?.close();
    await secretsBrokerProcess?.close();
    await sshServer?.close();
    if (dataDir !== undefined) await rm(dataDir, { recursive: true, force: true });
  });

  it("runs a real tools/call through Execution and the Secrets Broker, over real IPC channels, against a real local SSH server", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "agentforge-it-"));
    const secretsFilePath = join(dataDir, "secrets.json");
    const masterKey = generateKey();

    // Seed the Secrets Broker's on-disk store BEFORE the Broker process starts, using the same
    // master key the child process will be told to use — this is the parent test process playing
    // the role of "the operator already registered this SSH key via the Broker's own API"
    // (DEC-033), not something execution-ssh or the Broker's IPC server ever does themselves.
    sshServer = await startMockSshServer();
    const seedStore = new SecretStore(secretsFilePath, masterKey);
    const sshKeySecretId = await seedStore.create(
      "ssh-key",
      { privateKey: sshServer.clientPrivateKey },
      undefined,
      "integration test key",
    );

    secretsBrokerProcess = await spawnTestProcess(join(helpersDir, "secrets-broker-process.mjs"), [
      secretsFilePath,
      masterKey.toString("base64"),
    ]);

    const toolIdentity = "integration-tool-1" as ToolIdentity;
    const hostId = "integration-host-1";
    const executionSocketPath = executionChannelSocketPath();

    executionProcess = await spawnTestProcess(join(helpersDir, "execution-ssh-process.mjs"), [
      executionSocketPath,
      hostId,
      "127.0.0.1",
      String(sshServer.port),
      "integration-test-user",
      sshKeySecretId,
      toolIdentity,
    ]);

    executionClient = new NetExecutionChannelClient(executionSocketPath);
    await executionClient.connect();

    const decision: PolicyDecision = {
      verdict: "allow",
      ruleApplied: "risk-default",
      baseRisk: "read-only",
      identity: toolIdentity,
      schemaFingerprint: "fp-integration-test" as SchemaFingerprint,
    };

    const response = await executionClient.request({
      identity: toolIdentity,
      hostId,
      parameters: {},
      decision,
      sessionId: randomUUID(),
      operationId: randomUUID(),
    } as never);

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.outcome.kind).toBe("executed");
      if (response.outcome.kind === "executed") {
        expect(response.outcome.exitCode).toBe(0);
        // Proves the whole real round trip happened: the command template resolved by
        // execution-ssh (DEC-037) actually reached the real local SSH server and its exact
        // command string came back on stdout via the mock's echo handler. Quoted per-argv
        // element (`'echo' 'integration-test-payload'`) is the correct, expected shape — see
        // `shell-quote.ts`/the Fase 7 security fix this exercises for real over an actual wire.
        expect(response.outcome.stdout).toContain(
          "echo-from-mock-ssh-server:'echo' 'integration-test-payload'",
        );
      }
    }
  });

  it("fails closed when the Secrets Broker process is not running", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "agentforge-it-"));
    sshServer = await startMockSshServer();

    const toolIdentity = "integration-tool-2" as ToolIdentity;
    const hostId = "integration-host-2";
    const executionSocketPath = executionChannelSocketPath();

    // No secretsBrokerProcess spawned in this test — execution-ssh's default channel client
    // (DEC-070/065) must fail closed, never fall back to any other secret source.
    executionProcess = await spawnTestProcess(join(helpersDir, "execution-ssh-process.mjs"), [
      executionSocketPath,
      hostId,
      "127.0.0.1",
      String(sshServer.port),
      "integration-test-user",
      "nonexistent-secret-id" as SecretId,
      toolIdentity,
    ]);

    executionClient = new NetExecutionChannelClient(executionSocketPath);
    await executionClient.connect();

    const decision: PolicyDecision = {
      verdict: "allow",
      ruleApplied: "risk-default",
      baseRisk: "read-only",
      identity: toolIdentity,
      schemaFingerprint: "fp-integration-test" as SchemaFingerprint,
    };

    const response = await executionClient.request({
      identity: toolIdentity,
      hostId,
      parameters: {},
      decision,
      sessionId: randomUUID(),
      operationId: randomUUID(),
    } as never);

    expect(response.ok).toBe(true);
    if (response.ok) {
      // execute() surfaces a missing/unreachable secret as a "failed" outcome (never as a thrown
      // error that could crash the process, never as an implicit "proceed without a key").
      expect(response.outcome.kind).toBe("failed");
    }
  });
});
