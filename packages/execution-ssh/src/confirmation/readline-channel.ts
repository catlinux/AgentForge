import { createInterface } from "node:readline/promises";
import type {
  ConfirmationChannel,
  ConfirmationPrompt,
  ConfirmationResponse,
} from "./confirmation-channel.js";

/**
 * Reference implementation of `ConfirmationChannel` for this phase: a synchronous stdin/stdout
 * prompt. Requires an operator with direct interactive access to this process (documented
 * limitation of DEC-038) — not suitable for non-interactive deployments, where the timeout below
 * causes a deny-by-default outcome instead of hanging indefinitely.
 */
export class ReadlineConfirmationChannel implements ConfirmationChannel {
  async requestConfirmation(
    prompt: ConfirmationPrompt,
    timeoutMs: number,
  ): Promise<ConfirmationResponse> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const question = [
      `Confirmation required (operation ${prompt.operationHash}):`,
      `  host: ${prompt.hostname}`,
      `  command: ${prompt.resolvedCommand.join(" ")}`,
      "Approve? [y/N] ",
    ].join("\n");

    const timeout = new Promise<ConfirmationResponse>((resolve) => {
      setTimeout(() => resolve({ kind: "timed-out" }), timeoutMs).unref();
    });

    const answerPromise = rl
      .question(question)
      .then((answer): ConfirmationResponse =>
        answer.trim().toLowerCase() === "y" ? { kind: "approved" } : { kind: "rejected" },
      )
      .finally(() => rl.close());

    return Promise.race([answerPromise, timeout]);
  }
}
