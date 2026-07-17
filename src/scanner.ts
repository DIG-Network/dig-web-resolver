/**
 * The DOM scanner — finds the narrow set of attributes that may carry a DIG
 * reference and rewrites each to the engine's VERIFIED URL. It touches only the
 * media / style surfaces enumerated in SPEC §DOM-scan; it never reads computed
 * styles, never reparses a value into markup, and never resolves `form action`,
 * `fetch`, or `XHR` targets.
 *
 * Re-processing is guarded twice: an `inFlight` WeakSet stops a node being
 * resolved concurrently, and — because a resolved attribute holds a `blob:`/`data:`
 * URL that no longer matches a DIG reference — a re-scan of the same node is a
 * cheap no-op.
 */
import { containsDigRef, replaceCssUrls, replaceDigRefs } from "./matcher";
import { resolveContentUrl, resolveImageUrl } from "./engine";
import { registerContentBlob } from "./blob-registry";
import { serviceWorkerControlsPage } from "./sw/coexist";
import { digPathFor } from "./sw/urn-path";

// The elements a scan inspects (links are handled by the click interceptor). The
// `[style*="url"]` term is deliberately paren-free: a `(` inside an attribute
// selector breaks jsdom's querySelectorAll engine. It over-selects harmlessly —
// every candidate is re-gated by `containsDigRef` before any work.
export const SCAN_SELECTOR = 'img,source,video,audio,link,style,[style*="url"]';

const inFlight = new WeakSet<Element>();

/** Rewrite an image-context attribute (whole value may hold refs + descriptors). */
async function rewriteImageAttr(el: Element, attr: string): Promise<void> {
  const value = el.getAttribute(attr);
  if (!containsDigRef(value)) return;
  const next = await replaceDigRefs(value!, resolveImageUrl);
  if (next !== value) el.setAttribute(attr, next);
}

/** Rewrite a content-context attribute (stylesheet / media bytes → blob URL). */
async function rewriteContentAttr(el: Element, attr: string): Promise<void> {
  const value = el.getAttribute(attr);
  if (!containsDigRef(value)) return;
  const next = await replaceDigRefs(value!, resolveContentUrl);
  if (next === value) return;
  el.setAttribute(attr, next);
  // A content attribute holds a single URL — track the minted blob so it can be
  // revoked when this node is removed or the attribute is later re-pointed.
  registerContentBlob(el, attr, next);
}

/**
 * Rewrite a content-context reference to a Tier-2 `/__dig/<urn>` path so the
 * controlling Service Worker serves it natively (full fidelity — recursive `url()`
 * inside a served stylesheet resolves). Used INSTEAD of the blob-swap when a dig SW
 * controls the page, keeping the two tiers disjoint (no double-resolve).
 */
async function rewriteToSwPath(el: Element, attr: string): Promise<void> {
  const value = el.getAttribute(attr);
  if (!containsDigRef(value)) return;
  const next = await replaceDigRefs(value!, async (ref) => digPathFor(ref));
  if (next !== value) el.setAttribute(attr, next);
}

/** Rewrite DIG `url(...)` refs inside an author-set `style` attribute. */
async function rewriteStyleAttr(el: Element): Promise<void> {
  const value = el.getAttribute("style");
  if (!containsDigRef(value)) return;
  const next = await replaceCssUrls(value!, resolveImageUrl);
  if (next !== value) el.setAttribute("style", next);
}

/** Rewrite DIG `url(...)` refs inside a `<style>` element's own CSS text. */
async function rewriteStyleElement(el: HTMLStyleElement): Promise<void> {
  const css = el.textContent;
  if (!containsDigRef(css)) return;
  const next = await replaceCssUrls(css!, resolveImageUrl);
  if (next !== css) el.textContent = next;
}

/** A `<source>` belongs to `<picture>` (image) or `<video>/<audio>` (content). */
function isPictureSource(el: Element): boolean {
  return el.parentElement?.tagName === "PICTURE";
}

/** Resolve every DIG reference on a single element (all its supported attrs). */
async function resolveElement(el: Element): Promise<void> {
  switch (el.tagName) {
    case "IMG":
      await Promise.all([rewriteImageAttr(el, "src"), rewriteImageAttr(el, "srcset")]);
      break;
    case "SOURCE":
      if (isPictureSource(el)) {
        await Promise.all([rewriteImageAttr(el, "src"), rewriteImageAttr(el, "srcset")]);
      } else {
        await rewriteContentAttr(el, "src");
      }
      break;
    case "VIDEO":
    case "AUDIO":
      await Promise.all([rewriteContentAttr(el, "src"), rewriteImageAttr(el, "poster")]);
      break;
    case "LINK": {
      const rel = (el.getAttribute("rel") ?? "").toLowerCase();
      if (rel.includes("icon")) {
        await rewriteImageAttr(el, "href");
      } else if (serviceWorkerControlsPage()) {
        // Tier 2 present: hand stylesheet/preload bytes to the SW via a `/__dig/`
        // path (full fidelity) rather than blob-swapping them here.
        await rewriteToSwPath(el, "href");
      } else {
        await rewriteContentAttr(el, "href");
      }
      break;
    }
    case "STYLE":
      await rewriteStyleElement(el as HTMLStyleElement);
      break;
  }
  // Any element may carry an author-set `style="…url(dig)…"`.
  await rewriteStyleAttr(el);
}

/** Resolve one element with the in-flight guard + a fail-safe boundary. */
function scanOne(el: Element): void {
  if (inFlight.has(el)) return;
  inFlight.add(el);
  resolveElement(el)
    .catch((err) => console.error("dig-web-resolver: resolve failed", err))
    .finally(() => inFlight.delete(el));
}

/**
 * Scan a subtree: the node itself (if in scope) plus every matching descendant.
 * Called for the initial full-document pass and for each node the observer adds.
 */
export function scanSubtree(root: Element): void {
  if (root.matches(SCAN_SELECTOR)) scanOne(root);
  root.querySelectorAll(SCAN_SELECTOR).forEach(scanOne);
}
