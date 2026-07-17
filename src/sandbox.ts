/**
 * Opaque-origin viewer for resolved DIG link content.
 *
 * A `chia://` / `urn:dig:chia:` link never navigates the host page. Instead the
 * verified content is shown inside a SANDBOXED `<iframe>` whose sandbox grants ONLY
 * `allow-scripts` — no `allow-same-origin` (so the frame is an opaque origin, unable
 * to touch the host DOM/cookies/storage), and deliberately NO `allow-popups` /
 * `allow-forms`: resolved content is merkle-verified but still UNTRUSTED, and popups
 * + form submission would let it phish or exfiltrate what a user types to arbitrary
 * external endpoints. Dig content needs scripts to render, not to POST outward. The
 * content is loaded from a `blob:` URL (never `innerHTML`, never `eval`).
 *
 * The overlay always offers an escape hatch (a close button, the Escape key, and a
 * backdrop click), so the user is never trapped (professional-ui HARD RULE).
 */

const OVERLAY_ID = "dig-web-resolver-overlay";

/** Open resolved content in the isolated viewer. A second open replaces the first. */
export function openInSandbox(blobUrl: string, label: string): void {
  closeExisting();

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `DIG content: ${label}`);
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "display:flex",
    "flex-direction:column",
    "background:rgba(8,10,14,0.92)",
  ].join(";");

  overlay.appendChild(buildToolbar(blobUrl));
  overlay.appendChild(buildFrame(blobUrl, label));

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close(overlay, blobUrl, onKeydown);
  };
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close(overlay, blobUrl, onKeydown);
  });
  document.addEventListener("keydown", onKeydown, true);

  document.body.appendChild(overlay);
  overlay.querySelector<HTMLButtonElement>("button")?.focus();
}

function buildToolbar(blobUrl: string): HTMLElement {
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;justify-content:flex-end;padding:12px;gap:8px";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.setAttribute("aria-label", "Close DIG content viewer");
  closeButton.style.cssText = [
    "font:600 14px/1 system-ui,sans-serif",
    "color:#0b0e13",
    "background:#7dd3fc",
    "border:0",
    "border-radius:8px",
    "padding:10px 16px",
    "cursor:pointer",
  ].join(";");
  closeButton.addEventListener("click", () => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) close(overlay, blobUrl);
  });

  bar.appendChild(closeButton);
  return bar;
}

function buildFrame(blobUrl: string, label: string): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.title = `DIG content: ${label}`;
  // ONLY `allow-scripts`: opaque origin (no allow-same-origin) AND no outward reach
  // (no allow-popups / allow-forms) — see the module doc-comment.
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.style.cssText = "flex:1;width:100%;border:0;background:#fff";
  frame.src = blobUrl;
  return frame;
}

function close(overlay: Element, blobUrl: string, onKeydown?: (event: KeyboardEvent) => void): void {
  overlay.remove();
  if (onKeydown) document.removeEventListener("keydown", onKeydown, true);
  URL.revokeObjectURL(blobUrl);
}

function closeExisting(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}
