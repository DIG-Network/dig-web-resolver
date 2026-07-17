// Flat ESLint config — strict TypeScript, zero errors is the gate (CLAUDE.md §2.4a).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "src/generated/**", "playwright-report/**", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { window: "readonly", document: "readonly", MutationObserver: "readonly", URL: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["scripts/**/*.mjs", "e2e/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
  {
    files: ["**/*.test.ts", "e2e/**/*.ts", "scripts/**/*.mjs", "e2e/**/*.mjs", "*.config.*"],
    rules: { "@typescript-eslint/no-explicit-any": "off", "no-console": "off" },
  },
  {
    // The hand-written Service Worker e2e fixtures run in a ServiceWorkerGlobalScope.
    files: ["e2e/fixtures/**/*.js"],
    languageOptions: { globals: { self: "readonly", Response: "readonly", URL: "readonly" } },
  },
);
