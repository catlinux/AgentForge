import { defineConfig } from "vitest/config";

/**
 * Coverage-only root config (Fase 14, DEC-073). The actual per-package test projects are defined
 * by `vitest.workspace.ts` — this file only supplies `test.coverage` settings that apply when
 * running `pnpm run test:coverage`, since Vitest's workspace mode does not read coverage options
 * from `defineWorkspace()` itself. Informative only: no `thresholds` configured, so a low
 * percentage never fails the run (DEC-073 — visibility first, no enforced minimum yet).
 */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Only ever measure hand-written source, never compiled output or test files themselves.
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        "packages/*/src/**/*.test.ts",
        "packages/*/dist/**",
        "packages/dashboard/src/public/**",
      ],
    },
  },
});
