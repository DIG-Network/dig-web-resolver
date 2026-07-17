# Development log — dig-web-resolver

Durable, high-signal realizations. Not a change diary.

## The engine parses only `urn:dig:chia:` — normalise `chia://` in the loader

`@dignetwork/dig-urn-resolver`'s parser delegates to `digstore_core::Urn::parse`, which
accepts ONLY the `urn:dig:chia:<store>[:<root>]/<path>[?salt=]` grammar. The
user-facing `chia://` scheme is NOT accepted — passing it straight through makes
`resolve()` reject with a parse error (symptom: a `chia://` link click resolved to
nothing / no sandbox). The loader normalises `chia://` → `urn:dig:chia:` (prefix swap,
everything else verbatim, root-pinning preserved) in the engine wrapper before every
`resolve`/`resolveImageUrl`. See `src/engine.ts` `toEngineUrn`.

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
