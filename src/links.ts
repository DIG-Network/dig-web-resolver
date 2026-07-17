/**
 * Link interception — a delegated, capture-phase click listener that catches any
 * `<a href>` pointing at a DIG reference, cancels the host navigation, and opens
 * the verified content in the opaque-origin sandbox (never the host origin).
 */
import { containsDigRef } from "./matcher";
import { resolveContentUrl } from "./engine";
import { openInSandbox } from "./sandbox";

/**
 * Install the interceptor on `root`. Returns a disposer that removes it.
 * Capture phase (`true`) so we act before the browser's default navigation.
 */
export function installLinkInterceptor(root: Document = document): () => void {
  const handler = (event: Event) => {
    const start = event.target;
    if (!(start instanceof Element)) return;
    const anchor = start.closest("a[href]");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!containsDigRef(href)) return;
    event.preventDefault();
    void openDigLink(href!);
  };
  root.addEventListener("click", handler, true);
  return () => root.removeEventListener("click", handler, true);
}

async function openDigLink(ref: string): Promise<void> {
  try {
    const blobUrl = await resolveContentUrl(ref);
    openInSandbox(blobUrl, ref);
  } catch (err) {
    console.error("dig-web-resolver: link resolve failed", err);
  }
}
