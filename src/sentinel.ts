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

/** The frozen record written to `window.__digWebResolver` by the winning instance. */
export interface DigWebResolverClaim {
  readonly claimed: true;
  readonly version: string;
  readonly source: ClaimSource;
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
export function tryClaim(version: string, source: ClaimSource, now: number = Date.now()): boolean {
  const existing = window.__digWebResolver;
  if (existing && existing.claimed === true) {
    return false;
  }
  const claim: DigWebResolverClaim = { claimed: true, version, source, claimedAt: now };
  window.__digWebResolver = Object.freeze(claim);
  return true;
}
