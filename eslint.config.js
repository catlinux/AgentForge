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
);
