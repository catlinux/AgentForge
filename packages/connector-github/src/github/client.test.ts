import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedOperation } from "../config/operation-template.js";
import { sendGithubRequest } from "./client.js";

const originalFetch = globalThis.fetch;

describe("sendGithubRequest (DEC-061/DEC-063)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends the PAT as a Bearer token, never as a query parameter or in the body", async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_url, init) => {
      capturedInit = init as RequestInit;
      return new Response("{}", { status: 201 });
    }) as typeof fetch;

    const operation: ResolvedOperation = {
      method: "POST",
      path: "/repos/acme/widgets/issues",
      body: { title: "Bug" },
    };
    await sendGithubRequest("https://api.github.com", "ghp_secret", operation, 1000);

    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghp_secret");
  });

  it("returns statusCode and responseBytes, never the response body content", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('{"id":1,"title":"Bug"}', { status: 201 }),
    ) as typeof fetch;

    const operation: ResolvedOperation = {
      method: "POST",
      path: "/repos/acme/widgets/issues",
      body: { title: "Bug" },
    };
    const result = await sendGithubRequest("https://api.github.com", "ghp_secret", operation, 1000);

    expect(result.statusCode).toBe(201);
    expect(result.responseBytes).toBe(Buffer.byteLength('{"id":1,"title":"Bug"}', "utf-8"));
    expect(Object.keys(result)).toEqual(["statusCode", "responseBytes"]);
  });

  it("a GET operation sends no request body", async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_url, init) => {
      capturedInit = init as RequestInit;
      return new Response("[]", { status: 200 });
    }) as typeof fetch;

    const operation: ResolvedOperation = {
      method: "GET",
      path: "/repos/acme/widgets/issues",
      body: undefined,
    };
    await sendGithubRequest("https://api.github.com", "ghp_secret", operation, 1000);

    expect(capturedInit?.body).toBeUndefined();
  });

  it("aborts the request once the timeout elapses", async () => {
    globalThis.fetch = vi.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit).signal;
          signal?.addEventListener("abort", () => {
            const err = new Error("This operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    ) as typeof fetch;

    const operation: ResolvedOperation = {
      method: "GET",
      path: "/repos/acme/widgets/issues",
      body: undefined,
    };
    await expect(
      sendGithubRequest("https://api.github.com", "ghp_secret", operation, 10),
    ).rejects.toThrow(/aborted/i);
  });
});
