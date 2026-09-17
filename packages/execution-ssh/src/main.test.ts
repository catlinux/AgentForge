import { afterEach, describe, it } from "vitest";
import { connect, type Server } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:os";
import { startExecutionSsh } from "./main.js";

function testSocketPath(): string {
  if (platform() === "win32") {
    return `\\\\.\\pipe\\agentforge-execution-main-test-${Date.now()}-${Math.random()}`;
  }
  return join(tmpdir(), `agentforge-execution-main-test-${Date.now()}-${Math.random()}.sock`);
}

describe("startExecutionSsh (Fase 16 real entrypoint)", () => {
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

  it("loads config (defaulting to empty when no file exists) and listens on the given socket", async () => {
    dataDirPath = await mkdtemp(join(tmpdir(), "agentforge-execution-main-"));
    const socketPath = testSocketPath();

    server = await startExecutionSsh(dataDirPath, socketPath);

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
