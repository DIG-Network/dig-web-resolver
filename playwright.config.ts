import { defineConfig, devices } from "@playwright/test";

// The e2e suite loads the REAL built IIFE bundle (real wasm engine) in a real
// browser. It requires `npm run build` first (the webServer serves `dist/`).
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/serve.mjs",
    url: "http://localhost:4173/e2e/fixtures/basic.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
