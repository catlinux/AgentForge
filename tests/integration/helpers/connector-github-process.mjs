// Test-only process entrypoint (Fase 14, DEC-072) — NOT a production `main`/CLI. Spawned as a
// real child process so connector-github really runs in its own OS process (DEC-058), using its
// own real default Secrets Broker channel client (DEC-070/065) rather than an injected mock.
import { OperationHashRegistry } from "@agentforge/connector-github/dist/confirmation/hash-registry.js";
import { startConnectorServer } from "@agentforge/connector-github/dist/ipc/connector-server.js";

const [, , socketPath, accountId, apiBaseUrl, tokenSecretIdRaw, toolIdentityRaw] = process.argv;
if (
  socketPath === undefined ||
  accountId === undefined ||
  apiBaseUrl === undefined ||
  tokenSecretIdRaw === undefined ||
  toolIdentityRaw === undefined
) {
  console.error(
    "usage: connector-github-process.mjs <socketPath> <accountId> <apiBaseUrl> <tokenSecretId> <toolIdentity>",
  );
  process.exit(1);
}

const config = {
  accounts: [{ accountId, apiBaseUrl, tokenSecretId: tokenSecretIdRaw }],
  operationTemplates: {
    [toolIdentityRaw]: {
      method: "POST",
      path: "/repos/{{owner}}/{{repo}}/issues",
      bodyFields: ["title"],
    },
  },
};

startConnectorServer(
  {
    config,
    confirmationChannel: { requestConfirmation: async () => ({ kind: "approved" }) },
    confirmationRegistry: new OperationHashRegistry(),
    confirmationTimeoutMs: 5000,
    httpTimeoutMs: 5000,
    // No `getTokenSecret` injected — DEC-070/065 default wiring against the real Secrets Broker
    // channel is exactly what this integration test exists to exercise.
  },
  socketPath,
);

console.log("ready");
