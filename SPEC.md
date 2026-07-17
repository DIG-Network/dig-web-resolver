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
    mode: "dom",               // "dom" (DOM loader) | "sw" (a Tier-2 SW controls the page)
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
- **`mode`** records the active resolution strategy: `"dom"` (the Tier-1 DOM loader
  owns everything) or `"sw"` (a Tier-2 dig Service Worker controls the page — §10 — so
  the DOM loader defers `<link rel=stylesheet|preload>`/font content surfaces to it,
  §4 note). It is computed at claim time from whether a Service Worker controls the
  page.

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

**Escape hatch.** A site author who wants dig-hosted JavaScript has two sanctioned
paths, both of which are the author's own trust decision (never the loader's): call
the engine explicitly (`dig.resolve(urn)` via the ESM API) and inject it themselves;
or adopt the **Tier-2 Service Worker (§10)**, which serves `/__dig/<urn>` `<script>`/
stylesheet/font bytes natively. The Tier-1 loader itself never auto-executes resolved
content.

Also never touched: `<form action>`, `fetch`/`XHR`, and any non-media, non-style,
non-link target.

**Re-processing guard.** A resolved attribute holds a `blob:`/`data:` URL that no
longer matches a DIG reference, so a re-scan of the same node is a no-op; an
`inFlight` set additionally prevents concurrent double-resolution, and a rewrite is
applied only when the value actually changes (no mutation loops).

**Blob-URL lifecycle (no leaks).** Content/media resolution (`<video|audio src>`,
non-picture `<source>`, `<link rel=stylesheet|preload>`) MINTS a `blob:` URL via
`URL.createObjectURL`, which pins the blob until revoked. The loader tracks each such
minted URL per node and MUST `URL.revokeObjectURL` it when (a) the node is REMOVED from
the document (the observer's `removedNodes` branch, including a removed subtree's
content descendants), or (b) the attribute is RE-POINTED to a new reference (the stale
blob is revoked as the new one is minted) — so a long-lived SPA that swaps DIG media
does not leak blobs for the document lifetime. Image blobs come from the engine's
`resolveImageUrl` (engine-owned/cached — not minted here); link-viewer blobs are
revoked on the sandbox close path (§6).

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
shown inside a SANDBOXED `<iframe>` whose `sandbox` is EXACTLY `allow-scripts` — and
nothing else. Omitting `allow-same-origin` makes the frame an opaque origin fully
isolated from the host page (no host DOM, cookies, or storage access); omitting
`allow-popups` and `allow-forms` denies the verified-but-untrusted content any outward
reach (it cannot open popups or POST forms to external endpoints — the phishing /
exfiltration vector), while `allow-scripts` lets a resolved dig app render. The content
is loaded from a `blob:` URL built from the engine's verified bytes — NEVER via
`innerHTML`, NEVER `eval`, NEVER the host origin. The viewer always offers an escape
hatch (close button, Escape key, backdrop click) and revokes the object URL on close.

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
  `VERSION`, `tryClaim`, `registerDigSW`, `installDigServiceWorker`, `serveDigRef`, the
  `/__dig/` path helpers, and types. ESM consumers call `activate({ wasm })` themselves.
- `dist/dig-sw.js` — the Tier-2 module Service Worker (§10); the engine wasm is inlined.
  A site self-hosts this at its own origin and registers it via `registerDigSW()`.

Published as `@dignetwork/dig-web-resolver` (GPL-2.0-only, inherited from the engine).

## 9. Required embed CSP

A page embedding the loader must allow (this is byte-identical to the copy-paste
snippet in the README):

```
Content-Security-Policy:
  script-src 'self' 'wasm-unsafe-eval';
  connect-src https://dig.local https://localhost:9778 https://rpc.dig.net;
  img-src 'self' blob: data:;
```

- `script-src 'self' 'wasm-unsafe-eval'` — the loader script itself + instantiating the
  engine wasm.
- `connect-src https://dig.local https://localhost:9778 https://rpc.dig.net` — the
  §5.3 ladder tiers the engine probes/fetches.
- `img-src 'self' blob: data:` — the page's own images + the verified image blobs +
  branded error images.

## 10. Tier 2 — the Service Worker mode (full-fidelity subresources)

The Tier-1 DOM loader cannot resolve `<script>`, `<link rel=stylesheet>`, or fonts:
the browser fetches those itself at parse time, before an async in-page resolver runs,
and a `<script>` cannot be re-executed by a late `src` rewrite (§4a). A same-origin
**Service Worker** intercepts the browser's OWN subresource fetches before the
network, so it CAN serve decrypted, merkle-verified bytes the browser then executes /
applies natively. Tier 2 is OPT-IN per origin.

### 10.1 The `/__dig/<url-encoded-urn>` path convention

A Service Worker `fetch` handler fires for http(s) requests in scope, NEVER for a raw
`urn:`/`chia://` scheme. A dig reference the SW serves MUST therefore be expressed as
an in-scope http(s) path: `GET /__dig/<encodeURIComponent(urn)>`. `/__dig/` is the
reserved prefix. The SW:

- intercepts ONLY same-origin `GET` requests whose path is `/__dig/<segment>` where
  the decoded segment is ITSELF a complete DIG reference (`urn:dig:chia:…` or
  `chia://…`, normalised to the URN grammar);
- passes EVERYTHING else through to the network untouched — cross-origin, non-GET,
  ordinary assets, and `/__dig/` control/asset paths whose segment is NOT a dig
  reference (e.g. `/__dig/config.json`) or a malformed percent-escape (fail-closed);
- resolves the reference through the canonical `@dignetwork/dig-urn-resolver` engine
  (the SAME engine as Tier 1 — no second crypto implementation) and returns the result
  per §10.3.

A site author writes `<script src="/__dig/…">` / `<link rel=stylesheet href="/__dig/…">`
/ `@font-face { src: url("/__dig/…") }` directly; when a SW controls the page the
Tier-1 loader also REWRITES a stylesheet/preload `<link>` whose `href` is a `urn:`/
`chia://` reference to the `/__dig/` form so the SW serves it (no double-resolve — §4
note; the two tiers are disjoint).

### 10.2 Adoption — self-hosting (`registerDigSW`)

A Service Worker MUST be same-origin: a CDN snippet cannot register a dig.net SW onto a
third-party page. Tier 2 is therefore ALWAYS adopt-by-self-hosting — the site copies
`dig-sw.js` (shipped in the package `dist/`) to its OWN origin and registers it:

- `navigator.serviceWorker.register("/dig-sw.js", { scope: "/", type: "module" })`;
- secure-context only (HTTPS / `localhost`);
- on the very first (uncontrolled) load, ONE guarded reload (a `sessionStorage` flag
  prevents a loop) lets the SW gain control (`clients.claim()`), after which it
  intercepts the page's own parse-time subresource fetches;
- `registerDigSW(options?)` performs this and is the documented adoption helper.

`dig-sw.js` is a self-contained module SW with the engine wasm inlined (no second
fetch). The registration query MAY carry engine `endpoint`/`connectUrl` overrides
(§5.3); no ambient store pinning is used (each `/__dig/<urn>` is self-contained).

**Honest limitation.** The very first uncontrolled load's parse-time subresources are
NOT intercepted until the guarded reload takes control. Steady state is full fidelity.

### 10.3 Fail-closed responses (HARD)

The SW surfaces ONLY the engine's verified result; unverified bytes are NEVER served as
executable/applicable content:

| Engine outcome                                           | SW response                                                |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `success`                                                | `200` + the verified bytes under their real `Content-Type` |
| `integrity_failure`                                      | `409` + the engine's branded `text/html` page              |
| `unreachable`                                            | `503` + the engine's branded `text/html` page              |
| hard error (bad URN / RootRequired over rpc / not found) | `502` + a branded `text/html` body                         |

Every response carries `X-Content-Type-Options: nosniff` and a store `Content-Security-Policy`
(an SW-synthesized response inherits NO edge CSP, so the SW sets its own). A non-success
outcome is served under a NON-2xx status with a `text/html` type + `nosniff`, so the
browser will not execute it as script or apply it as style — fail-closed.

### 10.4 Security boundary (decided)

Serving decrypted `<script>` executes in the HOST origin with full DOM/cookie/storage
privileges. This is correct on a DEDICATED dig origin (the whole origin IS the store;
the same-origin policy is the isolation boundary). On a MIXED third-party page it is
the site author's explicit trust decision — inherent in the fact that they must
self-host + register the SW. The fail-closed matrix (§10.3) is non-negotiable and
inherited from the engine: only `success` bytes are ever served; every failure is the
branded artifact, never unverified plaintext.

### 10.5 Tier interplay (no double-resolve)

The frozen sentinel (§3) carries `mode`. A dig SW serves `<script>` / `<link
rel=stylesheet>` / fonts; the Tier-1 DOM loader serves `<img>`/media/`url()` (blob
swap) + `<a>` sandbox. When a SW controls the page the loader rewrites stylesheet/
preload `<link>` references to `/__dig/` paths (deferring them to the SW) instead of
blob-swapping. No surface is resolved by both tiers.

## 11. Conformance

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
- The Tier-2 Service Worker (§10) MUST intercept ONLY same-origin `GET /__dig/<segment>`
  requests whose decoded segment is a complete DIG reference, MUST pass everything else
  through untouched, MUST return verified `success` bytes under their real content type
  and every other outcome as a NON-2xx branded `text/html` response, and MUST set
  `X-Content-Type-Options: nosniff` + a store CSP on every response. It MUST NOT serve
  unverified bytes as executable/applicable content.
