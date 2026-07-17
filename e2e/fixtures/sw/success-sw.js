// A SUCCESS-emulator module Service Worker for the e2e mechanism proof.
//
// The REAL dig-sw.js resolves through the wasm engine, whose verified-SUCCESS path
// needs a live verified store + on-chain root (unavailable offline). This fixture
// SW emulates ONLY the engine's success OUTPUT — canned verified bytes served under
// the `/__dig/<url-encoded-urn>` convention with the same security headers the real
// serve core sets — so the e2e can prove the browser NATIVELY executes a SW-served
// `<script>` and APPLIES a SW-served `<link rel=stylesheet>` (the thing the Tier-1
// DOM loader provably cannot do). The engine's verify/decrypt + fail-closed matrix
// are covered by the jsdom unit suite (serve.test.ts) and the fail-closed e2e that
// runs the real dig-sw.js.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/__dig/")) return;

  const urn = decodeURIComponent(url.pathname.slice("/__dig/".length));
  const headers = { "x-content-type-options": "nosniff" };

  if (urn.endsWith(".js")) {
    event.respondWith(
      new Response("window.__digSwScriptRan = true;", {
        status: 200,
        headers: { ...headers, "content-type": "text/javascript" },
      }),
    );
  } else if (urn.endsWith(".css")) {
    event.respondWith(
      new Response("body { background-color: rgb(1, 2, 3); }", {
        status: 200,
        headers: { ...headers, "content-type": "text/css" },
      }),
    );
  }
});
