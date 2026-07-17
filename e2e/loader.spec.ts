import { expect, test } from "@playwright/test";

// These run the REAL inline-wasm bundle end-to-end in Chromium. Network to the DIG
// ladder is blocked, so the engine resolves fail-closed to its BRANDED error image /
// page — the deterministic, no-live-store outcome. (The verified-SUCCESS render path
// is covered by the jsdom unit suite with a mocked engine, since a real success needs
// a live verified store + on-chain root.)
async function blockDigNetwork(page: import("@playwright/test").Page): Promise<void> {
  for (const host of ["**://rpc.dig.net/**", "**://dig.local/**", "**://localhost:9778/**"]) {
    await page.route(host, (route) => route.abort());
  }
}

test("resolves a DIG <img> to the branded error image when the engine fails (fail-closed)", async ({
  page,
}) => {
  await blockDigNetwork(page);
  await page.goto("/e2e/fixtures/basic.html");

  const img = page.locator("#dig-image");
  // The engine swaps the urn:/chia: src for a branded data:image — NEVER unverified bytes.
  await expect(img).toHaveAttribute("src", /^data:image\//, { timeout: 20_000 });
});

test("intercepts a chia:// link and opens it in an opaque-origin sandbox", async ({ page }) => {
  await blockDigNetwork(page);
  await page.goto("/e2e/fixtures/basic.html");

  // Wait for the engine to be live (the image resolving is the readiness proxy),
  // then exercise the link interceptor.
  await expect(page.locator("#dig-image")).toHaveAttribute("src", /^data:image\//, { timeout: 20_000 });
  await page.locator("#dig-link").click();

  const overlay = page.locator("#dig-web-resolver-overlay");
  await expect(overlay).toBeVisible({ timeout: 20_000 });
  const sandbox = await overlay.locator("iframe").getAttribute("sandbox");
  expect(sandbox).not.toContain("allow-same-origin");
  // The user is never trapped — the close button dismisses the viewer.
  await overlay.getByRole("button", { name: /close/i }).click();
  await expect(overlay).toHaveCount(0);
});

test("no-ops on an already-claimed page (defers, leaves the DOM untouched)", async ({ page }) => {
  await blockDigNetwork(page);
  await page.goto("/e2e/fixtures/preclaimed.html");
  // Give any (wrongly-running) scan time to act.
  await page.waitForTimeout(1500);
  const src = await page.locator("#dig-image").getAttribute("src");
  expect(src).toMatch(/^urn:dig:chia:/);
});
