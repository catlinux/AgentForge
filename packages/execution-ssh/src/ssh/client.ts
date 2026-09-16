import { Client } from "ssh2";
import type { HostEntry } from "../config/host-config.js";
import { buildShellCommand } from "./shell-quote.js";
import { truncateOutput } from "./output-limits.js";

export interface SshExecResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Connects to `host`, runs the already-resolved `argv` (never a shell string, DEC-037), and
 * enforces a hard timeout (DEC-041) that force-closes the connection if exceeded. Output is
 * truncated per DEC-040 and never logged by this function.
 */
export function executeOverSsh(
  host: HostEntry,
  privateKey: string,
  passphrase: string | undefined,
  argv: readonly string[],
  timeoutMs: number,
): Promise<SshExecResult> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      conn.destroy();
      reject(new Error("SSH operation timed out"));
    }, timeoutMs);

    function finish(action: () => void): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    }

    conn
      .on("ready", () => {
        // ssh2's exec sends a single command string that the remote SSH server runs via its own
        // shell — there is no argv-literal exec mode in the SSH protocol. Each already-resolved
        // argv element (never free-form text, DEC-037) is POSIX-shell-quoted before joining, so
        // a parameter value containing shell metacharacters is passed through as a literal
        // argument on the remote side, not reinterpreted as shell syntax.
        conn.exec(buildShellCommand(argv), (err, stream) => {
          if (err) {
            finish(() => {
              conn.end();
              reject(err);
            });
            return;
          }
          const stdoutChunks: Buffer[] = [];
          const stderrChunks: Buffer[] = [];
          let exitCode = 0;

          stream
            .on("close", (code: number) => {
              exitCode = code;
              finish(() => {
                conn.end();
                resolve({
                  exitCode,
                  stdout: truncateOutput(stdoutChunks),
                  stderr: truncateOutput(stderrChunks),
                });
              });
            })
            .on("data", (chunk: Buffer) => {
              stdoutChunks.push(chunk);
            })
            .stderr.on("data", (chunk: Buffer) => {
              stderrChunks.push(chunk);
            });
        });
      })
      .on("error", (err) => {
        finish(() => reject(err));
      })
      .connect({
        host: host.hostname,
        port: host.port,
        username: host.username,
        privateKey,
        ...(passphrase !== undefined ? { passphrase } : {}),
      });
  });
}
