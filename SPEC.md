# dig-web-resolver — normative specification

This document is the authoritative embed contract for `@dignetwork/dig-web-resolver`.
An independent reimplementation MUST behave as specified here. Where this spec
references DIG read semantics (URN grammar, keys, the §5.3 ladder, fail-closed
verify-then-decrypt) it DEFERS to the canonical engine `@dignetwork/dig-urn-resolver`
(its `SPEC.md`) — this loader adds NO crypto, NO fetch, and NO trust logic of its own.

## 1. Purpose

A single CDN-droppable `<script>` that teaches any webpage to resolve DIG references
(`urn:dig:chia:…` / `chia://…`) in-page: it scans the DOM for such references,
resolves each through the wasm engine, and swaps in the engine's VERIFIED result —
so an ordinary `<img src="urn:dig:chia:…">` renders on a normal browser with no plugin.

## 2. References the loader acts on

The ONLY strings the loader ever touches are DIG references:

- a **URN** — `urn:dig:chia:<store_id>[:<root>]/<resource_key>[?salt=<hex>]`; or
- a **`chia://`** URL — `chia://<store_id>[:<root>]/<resource_key>[?salt=<hex>]`.

`chia://` is the same locator as the URN with a different prefix; the loader
NORMALISES it to the URN grammar (prefix swap `chia://` → `urn:dig:chia:`, everything
else verbatim, root-pinning preserved) before calling the engine, because the engine's
parser accepts only the URN form. Everything else in the DOM is left byte-identical.

## 3. Coexistence sentinel (`window.__digWebResolver`)

Before ANY wasm or DOM work, SYNCHRONOUSLY:

- If `window.__digWebResolver` exists AND its `.claimed === true` → the loader DEFERS
  entirely: no scan, no observer, no wasm init, `activate()` returns `null`.
- Otherwise the loader CLAIMS the page by assigning a FROZEN record and proceeds:

  ```js
  window.__digWebResolver = Object.freeze({
    claimed: true,
    version: "<pkg semver>",   // this build's version
    source: "page",            // "page" (default embed) | "extension" (WU2 injection)
    claimedAt: <epoch ms>,
  });
  ```

Rules (normative):

- **First-to-claim wins, version-agnostic.** An instance that finds the page already
  claimed NEVER takes over, regardless of its version relative to the incumbent.
- **The claim is frozen.** `Object.freeze` ensures a hostile page script cannot flip
  `claimed` to steal the page from an active loader. The loader only ever READS
  `.claimed`.
- **`source`** records who claimed: a page's own embed (`"page"`, the default) or the
  browser extension injecting the same bundle at `document_start` (`"extension"`, WU2).
  When the extension is present it claims first and the page embed defers.

## 4. DOM scan scope

On activation the loader performs one full-document scan and installs a
`MutationObserver` (subtree + `childList` + the watched attributes + `characterData`)
so nodes added or mutated later are also resolved. It resolves ONLY these surfaces:

| Surface                           | Attribute(s)                              | Resolution kind     |
| --------------------------------- | ----------------------------------------- | ------------------- |
| `<img>`                           | `src`, `srcset`                           | image               |
| `<source>` in `<picture>`         | `src`, `srcset`                           | image               |
| `<source>` in `<video>`/`<audio>` | `src`                                     | content             |
| `<video>`, `<audio>`              | `src`, `poster` (image)                   | content / image     |
| `<link rel=icon>`                 | `href`                                    | image               |
| `<link rel=stylesheet\|preload>`  | `href`                                    | content             |
| author-set CSS `url(...)`         | element `style` attribute, `<style>` text | image               |
| `<a>`                             | `href`                                    | link-intercept (§6) |

How each surface is resolved, tag by tag:

- **media** — `<img>`, `<source>`, `<video>`/`<audio>` `src`/`srcset`/`poster`: the
  attribute is swapped to the engine's verified `blob:` URL; the element re-fetches
  from the blob on the `src` change.
- **CSS `url(...)`** — inside a `<style>` element's text, a `style=""` attribute, or a
  `background-image` — the `url(urn:…)` TOKEN is rewritten to a `blob:` URL. The
  `<style>` tag itself is not "resolved"; its `url()` VALUES are. `srcset` is likewise
  token-substituted: only the DIG reference is replaced; descriptors and non-DIG
  candidates are preserved. The loader scans CSS ONLY where the author set it — it
  NEVER reads computed styles.
- **`<link rel=stylesheet href=urn:…>`** (explicit decision) — SUPPORTED: the `href` is
  swapped to a verified `blob:` of the CSS; a `<link>` re-fetches on `href` change, so
  the stylesheet applies (with a brief FOUC). **Caveat (documented limitation, deferred
  in WU1):** `url(urn:…)` references INSIDE that fetched CSS are NOT recursively
  resolved — the fetched stylesheet is opaque verified bytes to the loader. For
  no-local-node visitors, author `url()` targets in a dig-hosted stylesheet should be
  root-pinned + are handled only if the CSS is instead placed in a `<style>`
  element/`style` attribute the loader scans directly. `<link rel=icon|preload>` are
  resolved per the table above.

### 4a. Explicitly OUT of scope — `<script>` (mechanical AND security)

The loader NEVER resolves `<script>` (classic or module, `src` or inline), for two
reasons, both binding:

1. **Mechanically broken.** A `<script>` executes once at parse time; rewriting its
   `src` afterward is a no-op, and injecting a freshly-resolved script would break
   execution ordering and race the parser.
2. **Security (the real reason).** Executing resolved DIG bytes as JavaScript would run
   in the HOST origin with full DOM/cookie/storage privileges. Auto-injecting
   merkle-verified-but-nonetheless-untrusted code is exactly the XSS / supply-chain
   vector the fail-closed model forbids. The loader injects ONLY image blobs and
   opaque-origin sandboxed navigation (§6) — never executable content in the host
   origin.

**Escape hatch.** A site author who wants dig-hosted JavaScript calls the engine
explicitly (`dig.resolve(urn)` via the ESM API) and injects it themselves — that is
their page and their trust decision. The loader never auto-executes resolved content.

Also never touched: `<form action>`, `fetch`/`XHR`, and any non-media, non-style,
non-link target.

**Re-processing guard.** A resolved attribute holds a `blob:`/`data:` URL that no
longer matches a DIG reference, so a re-scan of the same node is a no-op; an
`inFlight` set additionally prevents concurrent double-resolution, and a rewrite is
applied only when the value actually changes (no mutation loops).

## 5. Public-read model + the ROOT-PINNED requirement (HARD)

The engine derives the read/decrypt key FROM THE URN (retrieval key =
`SHA-256(canonical rootless URN)`, decryption key = HKDF of the same), so a keyless
browser decrypts a public store with the URN alone — no wallet, no secret. Private
stores add an out-of-band `?salt=<hex>`. Resolution is always fail-closed
verify-then-decrypt: bytes are accepted only after inclusion + decrypt verification;
ANY failure yields the engine's BRANDED artifact, never unverified bytes.

**Over the public rpc tier (`rpc.dig.net`), ONLY root-pinned URNs resolve.** A rootless
`urn:dig:chia:<store>/<path>` (or `chia://<store>/<path>`) over rpc is REJECTED by the
engine (`RootRequired`) — its trust root would otherwise come from the same untrusted
gateway serving the bytes. A rootless reference resolves ONLY when a local dig-node
(`dig.local` / `localhost:9778`) is reachable, because the loopback node is itself the
trust anchor.

Consequence for embedders (see README): **a reference that must resolve for a visitor
with NO local dig-node MUST be root-pinned** — `urn:dig:chia:<store>:<root>/<path>` (or
`chia://<store>:<root>/<path>`). This matches how NFT URNs are already minted
root-pinned (#686). A rootless embed degrades to the engine's branded error image for
no-node visitors — fail-closed, never a broken or spoofable image.

## 6. Links — opaque-origin sandbox

A click on an `<a href>` whose target is a DIG reference is intercepted in the CAPTURE
phase: the host navigation is cancelled (`preventDefault`) and the verified content is
shown inside a SANDBOXED `<iframe>` whose `sandbox` OMITS `allow-same-origin`, so the
frame runs in an opaque origin fully isolated from the host page (no host DOM, cookies,
or storage access). The content is loaded from a `blob:` URL built from the engine's
verified bytes — NEVER via `innerHTML`, NEVER `eval`, NEVER the host origin. The viewer
always offers an escape hatch (close button, Escape key, backdrop click) and revokes
the object URL on close.

## 7. Fail-closed matrix

| Situation                                      | Image context                        | Content / link context                                  |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| Verified success                               | engine `blob:` of the real bytes     | `blob:` of verified bytes (opened in sandbox for links) |
| Integrity failure (tamper/wrong root/bad salt) | STATIC branded error image           | branded `text/html` page                                |
| Unreachable (no tier responded)                | branded "unreachable" image          | branded "unreachable" page                              |
| Rootless URN over rpc                          | branded error image (`RootRequired`) | branded error page                                      |
| Invalid URN / not found                        | branded error image                  | branded error page                                      |

In no case are unverified bytes assigned to the DOM. The loader owns none of these
outcomes — they are the engine's, surfaced unchanged.

## 8. Bundles + npm

Built from one TypeScript source:

- `dist/dig-web-resolver.iife.js` — the DEFAULT IIFE; the engine wasm is inlined as
  base64 (true single-tag drop, no second fetch). Auto-activates on load.
- `dist/dig-web-resolver.iife.external-wasm.js` + `dist/dig-web-resolver.wasm` — an
  IIFE for size-sensitive embeds; the wasm is a sidecar fetched from next to the script.
- `dist/dig-web-resolver.esm.js` — ESM for bundler consumers, exposing `activate()`,
  `VERSION`, `tryClaim`, and types. ESM consumers call `activate({ wasm })` themselves.

Published as `@dignetwork/dig-web-resolver` (GPL-2.0-only, inherited from the engine).

## 9. Required embed CSP

A page embedding the loader must allow:

- `script-src 'wasm-unsafe-eval'` — to instantiate the engine wasm.
- `connect-src https://dig.local https://localhost:9778 https://rpc.dig.net` — the
  §5.3 ladder tiers the engine probes/fetches.
- `img-src blob: data:` — the verified image blobs + branded error images.

## 10. Conformance

- The sentinel MUST claim synchronously before any await, MUST freeze the claim, and
  MUST defer (no side effects) when the page is already claimed.
- The scanner MUST resolve ONLY the §4 surfaces, MUST token-substitute (never reparse
  into markup), and MUST NOT touch computed styles, forms, or fetch/XHR.
- A DIG link MUST open in an opaque-origin (`allow-same-origin`-free) sandbox, never
  the host origin, never via `innerHTML`/`eval`.
- Every failure MUST surface the engine's branded artifact; unverified bytes MUST NEVER
  reach the DOM.
- A rootless URN over the rpc tier MUST fail closed (branded); a root-pinned URN MUST
  resolve. `chia://` MUST be normalised to the URN grammar with root-pinning preserved.
