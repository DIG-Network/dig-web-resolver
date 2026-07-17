/**
 * The coexistence sentinel — the crux of running the same loader from two
 * independent injectors (a page's own `<script>` and, later, the browser
 * extension at `document_start`) without either one fighting the other.
 *
 * FIRST-TO-CLAIM WINS, version-agnostic: whichever instance runs first freezes a
 * claim on `window.__digWebResolver`; every later instance sees `claimed` and
 * DEFERS entirely (no scan, no observer, no wasm init). The claim is frozen with
 * `Object.freeze` so a hostile page script cannot flip `claimed` back to steal the
 * page from an already-active loader.
 */

/** Who planted the claim: a page's own embed vs the browser extension (WU2). */
export type ClaimSource = "page" | "extension";

/**
 * The active resolution mode on this page:
 * - `"dom"` — the Tier-1 DOM loader resolves media / `url()` / links in-page (the
 *   default; no Service Worker controls the page).
 * - `"sw"` — a Tier-2 dig Service Worker controls the page and serves
 *   `<script>`/`<link rel=stylesheet>`/font bytes natively via `/__dig/`. The DOM
 *   loader still handles media/`url()`/links, but defers those content surfaces to
 *   the SW (see `scanner.ts` — no surface is resolved twice).
 */
export type ResolverMode = "dom" | "sw";

/** The frozen record written to `window.__digWebResolver` by the winning instance. */
export interface DigWebResolverClaim {
  readonly claimed: true;
  readonly version: string;
  readonly source: ClaimSource;
  readonly mode: ResolverMode;
  readonly claimedAt: number;
}

declare global {
  interface Window {
    // A hostile page may pre-set this to anything; we only ever READ `.claimed`.
    __digWebResolver?: { claimed?: boolean } | DigWebResolverClaim;
  }
}

/**
 * Attempt to claim the page for this loader instance, synchronously.
 *
 * @returns `true` if this instance won the claim (proceed to activate); `false` if
 *   the page was already claimed (this instance must defer and do nothing).
 */
export function tryClaim(
  version: string,
  source: ClaimSource,
  mode: ResolverMode = "dom",
  now: number = Date.now(),
): boolean {
  const existing = window.__digWebResolver;
  if (existing && existing.claimed === true) {
    return false;
  }
  const claim: DigWebResolverClaim = { claimed: true, version, source, mode, claimedAt: now };
  window.__digWebResolver = Object.freeze(claim);
  return true;
}
