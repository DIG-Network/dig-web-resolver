# @dignetwork/dig-web-resolver

A CDN-droppable `<script>` that teaches any webpage to resolve **`urn:dig:chia:…`** and
**`chia://…`** references in-page — the seamless DIG protocol bridge, powered by the
canonical [`@dignetwork/dig-urn-resolver`](https://www.npmjs.com/package/@dignetwork/dig-urn-resolver)
wasm engine.

Drop in one tag and an ordinary `<img src="urn:dig:chia:…">` renders on a normal
browser, with no plugin and no wallet — the loader finds DIG references in your images,
media, stylesheets, CSS `url(...)`, and links, resolves each through the engine, and
swaps in the **verified** result. Every failure is **fail-closed**: you get the engine's
branded error image, never unverified bytes.

## Quick start — one tag

```html
<!-- Inlined wasm: a true single-tag drop, no second fetch. -->
<script src="https://cdn.dig.net/dig-web-resolver.iife.js"></script>

<img src="urn:dig:chia:STORE_ID:ROOT/img/logo.png" alt="logo" />
<a href="chia://STORE_ID:ROOT/index.html">open the store</a>
```

That is all. The loader claims the page, scans it, watches for dynamically-added
nodes, and resolves every DIG reference it finds.

### Size-sensitive alternative (sidecar wasm)

```html
<script src="https://cdn.dig.net/dig-web-resolver.iife.external-wasm.js"></script>
<!-- serves dig-web-resolver.wasm from the same directory as the script -->
```

### Bundler / ESM

```js
import { activate } from "@dignetwork/dig-web-resolver";
import wasmUrl from "@dignetwork/dig-urn-resolver/web/dig_urn_resolver_bg.wasm?url";

await activate({ wasm: new URL(wasmUrl, import.meta.url) });
```

## Use ROOT-PINNED URNs for public pages (important)

The engine derives the decryption key **from the URN itself**, so a keyless browser
reads a public store with the URN alone. But there is one rule that decides whether a
reference resolves for a visitor who has **no local DIG node**:

> **Over the public gateway (`rpc.dig.net`), only ROOT-PINNED references resolve.**

- ✅ **Root-pinned** — `urn:dig:chia:STORE:ROOT/path` / `chia://STORE:ROOT/path` —
  resolves everywhere, including for a visitor with no local node. **Use this form for
  any image/link that must render for the public.** (This matches how NFT URNs are
  already minted — root-pinned, #686.)
- ⚠️ **Rootless** — `urn:dig:chia:STORE/path` — resolves ONLY when the visitor is
  running a local dig-node (`dig.local` / `localhost`), which acts as the trust anchor.
  Over the public gateway a rootless reference is rejected (`RootRequired`) and the
  loader shows the branded error image (fail-closed — never a spoofable image), because
  its trust root would otherwise come from the same untrusted gateway serving the bytes.

Private stores add an out-of-band secret salt: `urn:dig:chia:STORE:ROOT/path?salt=HEX`.

## Content Security Policy

Allow the loader to run the wasm engine and reach the DIG ladder:

```
Content-Security-Policy:
  script-src 'self' 'wasm-unsafe-eval';
  connect-src https://dig.local https://localhost:9778 https://rpc.dig.net;
  img-src 'self' blob: data:;
```

## What it resolves

`<img src|srcset>`, `<source>` (picture/video/audio), `<video|audio src|poster>`,
`<link rel=icon|preload|stylesheet href>`, author-set CSS `url(...)` (a `style`
attribute or a `<style>` element), and `<a href>` (intercepted — the verified content
opens in an isolated, opaque-origin sandbox, never the host page). It never touches
forms, `fetch`/`XHR`, or computed styles.

## Coexistence with the DIG browser extension

The loader claims `window.__digWebResolver` once (frozen, first-to-claim-wins). If the
DIG browser extension is present it claims the page first and your embed defers cleanly
— there is never a double-resolve. Embedding the tag is always safe.

## License

GPL-2.0-only (inherited from the `@dignetwork/dig-urn-resolver` read-crypto).

See [`SPEC.md`](./SPEC.md) for the normative embed contract.
