/**
 * Lifecycle tracking for the `blob:` URLs the loader MINTS itself.
 *
 * `resolveContentUrl` (media `src`, `<source>`, `<link rel=stylesheet|preload>`) calls
 * `URL.createObjectURL`, which pins the blob in memory until it is revoked. On a
 * long-lived SPA that swaps DIG media/stylesheets in and out, those URLs would leak
 * for the document lifetime. This registry revokes them on the two events that free a
 * blob: the owning node's resolved attribute being RE-POINTED, and the node being
 * REMOVED from the document.
 *
 * (Image blobs come from the engine's `resolveImageUrl` and are owned/cached by the
 * engine — the loader does not mint or revoke those. Link-viewer blobs are revoked on
 * the sandbox close path. This registry covers only the content/media blobs we mint.)
 */

/** The content-bearing elements a mint can attach to (used to walk a removed subtree). */
const CONTENT_SELECTOR = "video,audio,source,link";

// element → (attribute → the blob URL currently set on it). A WeakMap so a
// garbage-collected element drops its entry without our help.
const minted = new WeakMap<Element, Map<string, string>>();

/**
 * Record the blob URL now set on `el[attr]`, revoking any PRIOR blob this element held
 * for the same attribute (a re-point frees the stale one immediately).
 */
export function registerContentBlob(el: Element, attr: string, url: string): void {
  let byAttr = minted.get(el);
  if (!byAttr) {
    byAttr = new Map();
    minted.set(el, byAttr);
  }
  const previous = byAttr.get(attr);
  if (previous && previous !== url) URL.revokeObjectURL(previous);
  byAttr.set(attr, url);
}

/** Revoke every blob URL tracked for a single element and forget it. */
function revokeElement(el: Element): void {
  const byAttr = minted.get(el);
  if (!byAttr) return;
  for (const url of byAttr.values()) URL.revokeObjectURL(url);
  minted.delete(el);
}

/**
 * Revoke every content blob minted anywhere in a removed subtree (the removed node
 * itself plus any content-bearing descendant). Called from the observer's
 * `removedNodes` branch.
 */
export function revokeSubtree(root: Element): void {
  revokeElement(root);
  root.querySelectorAll(CONTENT_SELECTOR).forEach(revokeElement);
}
