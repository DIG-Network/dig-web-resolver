import { defineConfig } from "vitest/config";

// Unit suite runs in jsdom; the engine wasm is mocked, so no wasm ever loads here
// (Playwright covers the real-browser + real-bundle path). Coverage is CI-gated ≥80%.
export default defineConfig({
  define: {
    __DWR_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0-test"),
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**", "src/entry/**", "src/**/*.d.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
