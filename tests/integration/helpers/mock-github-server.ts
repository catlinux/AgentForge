import { createServer, type Server } from "node:http";

export interface MockGithubServer {
  readonly baseUrl: string;
  readonly receivedAuthorizationHeaders: string[];
  close(): Promise<void>;
}

/**
 * A real, local-only HTTP server (loopback, ephemeral port) standing in for the GitHub REST API
 * (Fase 14, DEC-072) — used so integration tests exercise the real `fetch`-based
 * `sendGithubRequest` in `packages/connector-github/src/github/client.ts` against a real socket,
 * never GitHub's actual API. Always responds 201 with a small fixed JSON body; records every
 * `Authorization` header it receives so a test can assert the real PAT (fetched over the real
 * Secrets Broker channel, DEC-070) reached the request.
 */
export async function startMockGithubServer(): Promise<MockGithubServer> {
  const receivedAuthorizationHeaders: string[] = [];

  const server: Server = createServer((req, res) => {
    receivedAuthorizationHeaders.push(req.headers.authorization ?? "");
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf-8");
    });
    req.on("end", () => {
      void body; // Received but deliberately unused — this mock never needs to inspect it.
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ number: 1, html_url: "https://example.invalid/mock-issue" }));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Mock GitHub server failed to bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    receivedAuthorizationHeaders,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}
