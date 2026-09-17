// Test-only process entrypoint (Fase 14, DEC-072) — NOT a production `main`/CLI. Spawned as a
// real child process by integration tests so the Secrets Broker really runs in its own OS
// process (DEC-004), listening on the real Execution<->Secrets Broker channel (DEC-070).
//
// The master key is passed as base64 over argv purely so the parent test process (which
// pre-populates the same encrypted secrets file before this process starts, to seed a known
// secret) and this child process share the exact same key — real deployments never pass a master
// key over argv (DEC-032: separate file, OS permissions), this is test-only plumbing to make the
// parent and child agree on one already-generated key.
import { SecretStore } from "@agentforge/secrets-broker/dist/storage/secret-store.js";
import { startExecutionSecretsServer } from "@agentforge/secrets-broker/dist/ipc/execution-secrets-server.js";
import { executionSecretsChannelPath } from "@agentforge/shared";

const [, , secretsFilePath, masterKeyBase64] = process.argv;
if (secretsFilePath === undefined || masterKeyBase64 === undefined) {
  console.error("usage: secrets-broker-process.mjs <secretsFilePath> <masterKeyBase64>");
  process.exit(1);
}

const store = new SecretStore(secretsFilePath, Buffer.from(masterKeyBase64, "base64"));
// Listens on the same fixed channel path execution-ssh's own default client connects to
// (DEC-070) — this test process plays the role of the one real Secrets Broker instance a real
// deployment would run (DEC-047's single-instance pattern), not an arbitrary test socket.
startExecutionSecretsServer(store, executionSecretsChannelPath());

// Signal readiness to the parent test process over stdout — the only content this process ever
// writes there, so the test can reliably wait for "listening" instead of guessing with a sleep.
console.log("ready");
