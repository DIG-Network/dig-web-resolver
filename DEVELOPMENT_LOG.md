# Development log — dig-web-resolver

Durable, high-signal realizations. Not a change diary.

## The engine parses only `urn:dig:chia:` — normalise `chia://` in the loader

`@dignetwork/dig-urn-resolver`'s parser delegates to `digstore_core::Urn::parse`, which
accepts ONLY the `urn:dig:chia:<store>[:<root>]/<path>[?salt=]` grammar. The
user-facing `chia://` scheme is NOT accepted — passing it straight through makes
`resolve()` reject with a parse error (symptom: a `chia://` link click resolved to
nothing / no sandbox). The loader normalises `chia://` → `urn:dig:chia:` (prefix swap,
everything else verbatim, root-pinning preserved) in the engine wrapper before every
`resolve`/`resolveImageUrl`. See `toEngineRef` in `src/matcher.ts` (re-exported from
`src/engine.ts`; it lives in the wasm-free matcher module so the Service Worker's
`/__dig/` path helpers can normalise without importing the engine glue).

## Root-pinned URNs are REQUIRED over the public rpc tier

The engine rejects a ROOTLESS URN over `rpc.dig.net` with `RootRequired` (its trust
root would otherwise come from the same untrusted gateway serving the bytes). A rootless
URN resolves ONLY via a local loopback dig-node (the node is the trust anchor). So a
public embed on a page with no local node MUST use `urn:dig:chia:STORE:ROOT/path` (or
`chia://STORE:ROOT/path`). NFT URNs are already minted root-pinned (#686). Surfaced in
SPEC §5 + README; a rootless-over-rpc reference degrades fail-closed to the branded
error image, never a spoofable image.

## jsdom's querySelectorAll (nwsapi) chokes on `(` in an attribute selector

`document.querySelectorAll('[style*="url("]')` returns 0 in jsdom even when
`element.matches('[style*="url("]')` returns true for the same element — nwsapi (the QSA
engine) mis-parses the unescaped `(` inside the attribute-selector string, while
`Element.matches` uses a different path. Fix: use a paren-free term (`[style*="url"]`)
and re-gate every candidate with `containsDigRef` (cheap). Cost real debugging time.

## Inline-wasm IIFE: define `import.meta.url` away so esbuild emits no stray asset

The engine's default init references `new URL('..._bg.wasm', import.meta.url)`. We always
pass explicit wasm (inlined bytes or a sidecar URL), so that branch is dead — but esbuild
special-cases a literal `import.meta.url` and would copy the wasm as a hashed asset (and
IIFE format can't use `import.meta` at all). Defining `import.meta.url` to `""` in the
build kills both problems. See `scripts/build.mjs`.

## Tier 2 = a Service Worker + the `/__dig/<url-encoded-urn>` path (not a raw scheme)

A SW `fetch` handler fires for http(s) requests in scope, NEVER for a `urn:`/`chia://`
scheme — so a dig reference the SW serves MUST be an in-scope http(s) path. Convention:
`GET /__dig/<encodeURIComponent(urn)>` (`/__dig/` is reserved, byte-shared with
on.dig.net). The SW decodes, resolves through the SAME `dig-urn-resolver` engine, and
returns verified bytes; this is the ONLY way to serve `<script>`/stylesheets/fonts the
browser executes natively (the DOM loader can't — parse-time fetch). Fail-closed: a
non-`success` outcome is served as a NON-2xx `text/html` branded page with `nosniff`, so
untrusted bytes never execute. A SW must be same-origin (can't register cross-origin from
a CDN) → Tier 2 is always adopt-by-self-hosting `dig-sw.js` + `registerDigSW()`.

## SW verified-SUCCESS can't be proven offline — split the e2e

The engine's verified-success path needs a live store + on-chain root (can't fabricate a
valid merkle-proof+ciphertext in a test). So the SW e2e is TWO proofs: (1) a
success-emulator fixture SW serving canned `/__dig/` bytes proves the browser NATIVELY
executes a SW-served `<script>` + applies a served stylesheet (the Tier-2 mechanism);
(2) the REAL `dig-sw.js` with the ladder blocked proves fail-closed (non-2xx branded, no
execution). The engine's verify/decrypt matrix is covered by the jsdom unit suite. Same
precedent as WU1's loader e2e (success render → unit, fail-closed → e2e).

## Strict TS: engine bytes may be `Uint8Array<SharedArrayBuffer>` — copy to `ArrayBuffer`

`new Response(engineBytes)` / passing inlined wasm to `init` fails `tsc` strict:
`Uint8Array<ArrayBufferLike>` isn't a `BodyInit`/`BufferSource` because the backing
buffer could be a `SharedArrayBuffer`. Fix: copy into a fresh concrete `ArrayBuffer`
(`serve.ts` `body()`) and allocate inline-wasm bytes over `new ArrayBuffer(n)`
(`base64.ts`) so the type is `Uint8Array<ArrayBuffer>`.
