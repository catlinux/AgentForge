// Test-only process entrypoint (Fase 14, DEC-072) — NOT a production `main`/CLI. Spawned as a
// real child process so execution-ssh really runs in its own OS process (DEC-042), using its own
// real default Secrets Broker channel client (DEC-070, DEC-065) rather than an injected mock —
// this process never receives `getSshKeySecret` explicitly, so it exercises the exact same
// default-wiring code path a real deployment would.
import { OperationHashRegistry } from "@agentforge/execution-ssh/dist/confirmation/hash-registry.js";
import { startExecutionServer } from "@agentforge/execution-ssh/dist/ipc/execution-server.js";

const [
  ,
  ,
  socketPath,
  hostId,
  sshHostname,
  sshPortRaw,
  sshUsername,
  sshKeySecretIdRaw,
  toolIdentityRaw,
] = process.argv;
if (
  socketPath === undefined ||
  hostId === undefined ||
  sshHostname === undefined ||
  sshPortRaw === undefined ||
  sshUsername === undefined ||
  sshKeySecretIdRaw === undefined ||
  toolIdentityRaw === undefined
) {
  console.error(
    "usage: execution-ssh-process.mjs <socketPath> <hostId> <sshHostname> <sshPort> <sshUsername> <sshKeySecretId> <toolIdentity>",
  );
  process.exit(1);
}

const config = {
  hosts: [
    {
      hostId,
      hostname: sshHostname,
      port: Number(sshPortRaw),
      username: sshUsername,
      sshKeySecretId: sshKeySecretIdRaw,
    },
  ],
  commandTemplates: {
    [toolIdentityRaw]: { argv: ["echo", "integration-test-payload"] },
  },
};

startExecutionServer(
  {
    config,
    confirmationChannel: { requestConfirmation: async () => ({ kind: "approved" }) },
    confirmationRegistry: new OperationHashRegistry(),
    confirmationTimeoutMs: 5000,
    sshTimeoutMs: 5000,
    // No `getSshKeySecret` injected — DEC-070/065 default wiring against the real Secrets Broker
    // channel is exactly what this integration test exists to exercise.
  },
  socketPath,
);

console.log("ready");
