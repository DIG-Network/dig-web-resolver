/**
 * The pure decision at the heart of the Service Worker's `fetch` handler: given a
 * request's method + URL and the SW's own origin, is this a dig-serve request, and
 * if so which reference does it carry?
 *
 * Kept free of any Service-Worker global so it is exhaustively unit-testable — the
 * thin runtime wiring (`runtime.ts`) is the only untested glue.
 */
import { digRefFromPath } from "./urn-path";

/**
 * The DIG reference a request should be served, or `null` to PASS THROUGH to the
 * network. A request is served only when it is a same-origin `GET` for a
 * `/__dig/<url-encoded-urn>` path whose segment is a complete DIG reference; every
 * other request (cross-origin, non-GET, a normal page asset, a `/__dig/` control
 * path) passes through untouched.
 */
export function digRefForRequest(method: string, url: string, origin: string): string | null {
  if (method !== "GET") return null;
  const parsed = new URL(url);
  if (parsed.origin !== origin) return null;
  return digRefFromPath(parsed.pathname);
}
