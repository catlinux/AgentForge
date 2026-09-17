import { spawn, type ChildProcess } from "node:child_process";

export interface SpawnedProcess {
  readonly child: ChildProcess;
  readonly stderr: string[];
  close(): Promise<void>;
}

/**
 * Spawns a real Node.js child process (Fase 14, DEC-072) running one of this directory's
 * test-only entrypoint scripts, and waits for it to print a literal `ready` line on stdout before
 * resolving — so a test never races against a server that hasn't started listening yet, without
 * resorting to a fixed sleep. Captures stderr so a test failure can surface what the child logged
 * instead of a bare timeout.
 */
export function spawnTestProcess(
  scriptPath: string,
  args: readonly string[],
): Promise<SpawnedProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { stdio: "pipe" });
    const stderr: string[] = [];
    let stdoutBuffer = "";
    let settled = false;

    const onStdout = (chunk: Buffer): void => {
      stdoutBuffer += chunk.toString("utf-8");
      if (settled) return;
      if (stdoutBuffer.split("\n").some((line) => line.trim() === "ready")) {
        settled = true;
        child.stdout?.off("data", onStdout);
        resolve({
          child,
          stderr,
          close: () => closeChild(child),
        });
      }
    };

    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk.toString("utf-8")));
    child.once("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          `Process ${scriptPath} exited before signaling ready (code ${String(code)}): ${stderr.join("")}`,
        ),
      );
    });
  });
}

function closeChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
    child.kill();
  });
}
