import { expect, test, type Page } from "@playwright/test";

// The Tier-2 Service Worker e2e. Two real-browser proofs:
//  1. NATIVE EXECUTION — a self-hosted SW that serves `/__dig/<urn>` bytes makes the
//     browser execute a served `<script>` and apply a served `<link rel=stylesheet>`
//     (the fidelity the Tier-1 DOM loader provably cannot reach). The verified-success
//     bytes are emulated by a fixture SW (a real store + on-chain root is unavailable
//     offline; the engine's verify/decrypt is covered by the jsdom serve.test.ts).
//  2. FAIL-CLOSED — the REAL dig-sw.js, with the DIG ladder blocked, serves a NON-2xx
//     branded page for `/__dig/<urn>`, so an injected `<script>` NEVER executes.

async function blockDigNetwork(page: Page): Promise<void> {
  for (const host of ["**://rpc.dig.net/**", "**://dig.local/**", "**://localhost:9778/**"]) {
    await page.route(host, (route) => route.abort());
  }
}

test("SW serves a decrypted <script> that EXECUTES and a stylesheet that APPLIES", async ({ page }) => {
  await page.goto("/e2e/fixtures/sw/success.html");

  // The injected `<script src=/__dig/…app.js>` is served by the controlling SW and
  // runs natively, setting the flag.
  await page.waitForFunction(() => (window as { __digSwScriptRan?: boolean }).__digSwScriptRan === true, {
    timeout: 20_000,
  });

  // The injected `<link rel=stylesheet href=/__dig/…app.css>` is served + applied.
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor), { timeout: 20_000 })
    .toBe("rgb(1, 2, 3)");
});

test("fail-closed: the real SW serves a NON-2xx branded page and the <script> does NOT execute", async ({
  page,
}) => {
  await blockDigNetwork(page);
  await page.goto("/e2e/fixtures/sw/failclosed.html");

  // Wait for the real dig-sw.js to control the page.
  await page.waitForFunction(() => (window as { __digSwReady?: boolean }).__digSwReady === true, {
    timeout: 20_000,
  });

  // A `/__dig/<urn>` fetch fails closed: a non-2xx status + a text/html branded body
  // (never `text/javascript`), so the browser will not execute it as script.
  const served = await page.evaluate(async () => {
    const res = await fetch("/__dig/" + encodeURIComponent("urn:dig:chia:teststore:testroot/evil.js"));
    return { status: res.status, contentType: res.headers.get("content-type") };
  });
  expect(served.status).toBeGreaterThanOrEqual(400);
  expect(served.contentType).not.toContain("javascript");

  // And the injected script provably never ran.
  await page.waitForTimeout(1000);
  const ran = await page.evaluate(() => (window as { __digSwScriptRan?: boolean }).__digSwScriptRan === true);
  expect(ran).toBe(false);
});
