import { afterEach, describe, it } from "vitest";
import { connect, type Server } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:os";
import { startSecretsBroker } from "./main.js";

function testSocketPath(): string {
  if (platform() === "win32") {
    return `\\\\.\\pipe\\agentforge-secrets-main-test-${Date.now()}-${Math.random()}`;
  }
  return join(tmpdir(), `agentforge-secrets-main-test-${Date.now()}-${Math.random()}.sock`);
}

describe("startSecretsBroker (Fase 16 real entrypoint)", () => {
  let server: Server | undefined;
  let dataDirPath: string | undefined;

  afterEach(async () => {
    server?.close();
    server = undefined;
    if (dataDirPath !== undefined) {
      await rm(dataDirPath, { recursive: true, force: true });
      dataDirPath = undefined;
    }
  });

  it("builds a real master key + secret store and listens on the given socket", async () => {
    dataDirPath = await mkdtemp(join(tmpdir(), "agentforge-secrets-main-"));
    const socketPath = testSocketPath();

    server = await startSecretsBroker(dataDirPath, socketPath);

    await new Promise<void>((resolve, reject) => {
      const socket = connect(socketPath);
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", reject);
    });
  });
});
