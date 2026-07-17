/**
 * The `/__dig/<url-encoded-urn>` path convention — the bridge between the browser's
 * OWN http(s) subresource fetches and the DIG engine.
 *
 * A Service Worker `fetch` handler fires for http(s) requests in scope, NEVER for a
 * raw `urn:`/`chia://` scheme, so a dig reference the SW can serve MUST be expressed
 * as an in-scope http(s) path. `/__dig/` is the reserved prefix (byte-identical to
 * the reservation `on.dig.net` already uses). A site author writes
 * `<script src="/__dig/urn%3Adig%3Achia%3A…">` (or the DOM loader rewrites a
 * stylesheet `href` to this form) and the SW resolves it fail-closed.
 */
import { isDigRef, toEngineRef } from "../matcher";

/** The reserved path prefix the dig Service Worker intercepts. */
export const DIG_PATH_PREFIX = "/__dig/";

/**
 * Build the in-scope http(s) path a dig reference is served under: the reference is
 * normalised to the engine URN grammar and URL-encoded into a single path segment,
 * so `<script src>` / `<link href>` / `@font-face src` can point at it directly.
 */
export function digPathFor(ref: string): string {
  return DIG_PATH_PREFIX + encodeURIComponent(toEngineRef(ref));
}

/**
 * Decode a request pathname back to the dig reference it carries, or `null` when the
 * path is not a dig-serve path.
 *
 * Returns the reference ONLY when the decoded segment is ITSELF a complete DIG
 * reference — so control/asset paths under `/__dig/` (e.g. `/__dig/config.json`, a
 * future wasm sidecar) fall through to the network untouched. A malformed
 * percent-escape yields `null` (fail-closed: the SW does not intercept it).
 */
export function digRefFromPath(pathname: string): string | null {
  if (!pathname.startsWith(DIG_PATH_PREFIX)) return null;
  const encoded = pathname.slice(DIG_PATH_PREFIX.length);
  if (!encoded) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  return isDigRef(decoded) ? decoded : null;
}
