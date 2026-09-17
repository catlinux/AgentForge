import type { ResolvedOperation } from "../config/operation-template.js";

export interface GithubHttpResult {
  readonly statusCode: number;
  readonly responseBytes: number;
}

/**
 * Sends `operation` to the GitHub REST API at `apiBaseUrl`, authenticated with `token` (a PAT,
 * DEC-061 — never OAuth in this phase). Uses Node's native `fetch` (DEC-063 — no HTTP client
 * dependency). Enforces a hard timeout via `AbortController`, mirroring DEC-041's SSH timeout
 * guarantee for this connector.
 *
 * DEC-060/DEC-055 minimization: the response body is read only to measure its byte length — its
 * content is never returned, logged, or retained beyond this function.
 */
export async function sendGithubRequest(
  apiBaseUrl: string,
  token: string,
  operation: ResolvedOperation,
  timeoutMs: number,
): Promise<GithubHttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}${operation.path}`, {
      method: operation.method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        ...(operation.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(operation.body !== undefined ? { body: JSON.stringify(operation.body) } : {}),
    });
    const text = await response.text();
    return {
      statusCode: response.status,
      responseBytes: Buffer.byteLength(text, "utf-8"),
    };
  } finally {
    clearTimeout(timer);
  }
}
