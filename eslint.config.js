// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // packages/dashboard/src/public is static browser JS/HTML/CSS served as-is (DEC-067, no
    // build step) — outside the TypeScript project graph, same reasoning as excluding it from
    // `tsc -b` in packages/dashboard/tsconfig.json.
    ignores: ["**/dist/**", "**/node_modules/**", "packages/dashboard/src/public/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // tests/integration/helpers/*.mjs and setup.mjs are real Node.js process entrypoints (Fase
    // 14/DEC-072, and the Fase-16-style interactive setup wizard) run directly by `node` — not
    // part of the TypeScript project graph, so they need Node's own globals rather than the
    // browser-oriented defaults `js.configs.recommended` assumes.
    files: ["tests/integration/helpers/*.mjs", "setup.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
      },
    },
  },
);
