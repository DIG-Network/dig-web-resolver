# Runbook — build & publish `@dignetwork/dig-web-resolver`

## Prerequisites

- Node.js ≥ 18, npm.
- `npm install` (installs the engine `@dignetwork/dig-urn-resolver`, whose wasm is
  inlined at build time).

## Local build

```bash
npm run gen:wasm   # base64-encode the engine wasm → src/generated/wasm-inline.ts
npm run build      # gen:wasm + esbuild (3 bundles) + tsc (.d.ts). Prints bundle sizes.
```

Outputs in `dist/`:

- `dig-web-resolver.iife.js` — default IIFE, wasm inlined (single-tag drop).
- `dig-web-resolver.iife.external-wasm.js` + `dig-web-resolver.wasm` — sidecar variant.
- `dig-web-resolver.esm.js` — ESM for bundlers.
- `index.d.ts` (+ per-module `.d.ts`) — types.
- `BUILD_SIZES.txt` — the measured sizes.

## Quality gates (must be green before merge)

```bash
npm run format:check   # prettier
npm run lint           # eslint, zero errors
npm run typecheck      # tsc --noEmit
npm test               # vitest + coverage (≥80% gate)
npm run build          # both IIFE bundles + ESM produced
npx playwright install chromium && npm run test:e2e   # real-browser e2e
```

## Release / publish

Releases are TAG-DRIVEN (CLAUDE.md §3.6, non-apps → per-merge tag):

1. Bump `version` in `package.json` per SemVer on the feature branch (the
   version-increment CI gate enforces an increase vs `main`).
2. Merge the PR (squash). `release.yml` regenerates `CHANGELOG.md` via git-cliff,
   commits it, and pushes the `vX.Y.Z` tag using `RELEASE_TOKEN`.
3. The tag fires `publish-npm.yml`, which builds and `npm publish`es
   `@dignetwork/dig-web-resolver` (org `NPM_TOKEN`).

Do NOT hand-push tags or hand-publish — the workflows own tagging + publish.

## Updating the inlined engine

Bump `@dignetwork/dig-urn-resolver` in `package.json`, `npm install`, `npm run build`
(re-inlines the new wasm), re-run the gates. The engine's fail-closed contract is
unchanged across minor versions.
