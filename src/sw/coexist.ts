/**
 * Tier-1 ↔ Tier-2 interplay helpers used by the DOM loader (`scanner.ts`).
 *
 * When a dig Service Worker (Tier 2) controls the page it serves `<script>`,
 * `<link rel=stylesheet>`, and font bytes NATIVELY via the `/__dig/` path
 * convention — with full fidelity (e.g. recursive `url()` inside a served
 * stylesheet). The DOM loader therefore must NOT also blob-swap those content
 * surfaces; instead it REWRITES their `urn:`/`chia://` reference to the `/__dig/`
 * path so the controlling SW resolves it. This keeps the two tiers strictly
 * disjoint — no surface is resolved twice.
 */

/** True iff a Service Worker currently controls this page (a dig SW, in practice). */
export function serviceWorkerControlsPage(): boolean {
  return (
    typeof navigator !== "undefined" && "serviceWorker" in navigator && !!navigator.serviceWorker.controller
  );
}
