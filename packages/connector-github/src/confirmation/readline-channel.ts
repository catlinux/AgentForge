import { createInterface } from "node:readline/promises";
import type {
  ConfirmationChannel,
  ConfirmationPrompt,
  ConfirmationResponse,
} from "./confirmation-channel.js";

/**
 * Reference implementation of `ConfirmationChannel` for this connector: a synchronous
 * stdin/stdout prompt — same pattern and documented limitation as
 * `execution-ssh/src/confirmation/readline-channel.ts` (DEC-038: requires an operator with direct
 * interactive access to this process; a timeout denies by default instead of hanging).
 */
export class ReadlineConfirmationChannel implements ConfirmationChannel {
  async requestConfirmation(
    prompt: ConfirmationPrompt,
    timeoutMs: number,
  ): Promise<ConfirmationResponse> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const question = [
      `Confirmation required (operation ${prompt.operationHash}):`,
      `  account: ${prompt.accountLabel}`,
      `  operation: ${prompt.operationSummary.join(" ")}`,
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
