import { defineConfig } from "vitest/config";

/**
 * Standalone Vitest project for integration tests (Fase 14, DEC-072) — deliberately NOT part of
 * `vitest.workspace.ts` (that workspace is for the fast, isolated per-package unit tests already
 * run by `pnpm run test`). These tests spawn real OS processes and real local sockets, so they
 * are slower and run only via `pnpm run test:integration`. They import the already-built `dist/`
 * output of each package (see helpers/spawn-process.ts) — `pnpm run build` is a precondition, not
 * something this config runs automatically.
 */
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ["**/*.test.ts"],
    testTimeout: 15000,
    // Every test file here spawns its own Secrets Broker process on the one fixed channel path
    // real deployments use (`executionSecretsChannelPath()`, DEC-047/070's documented
    // single-instance limitation) — running test files in parallel would have two unrelated
    // Broker processes racing for the same named pipe/socket. Sequential file execution avoids
    // that collision without weakening what each individual test actually verifies.
    fileParallelism: false,
  },
});
