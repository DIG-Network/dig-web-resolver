# Contributing to dig-web-resolver

## What this repo is

A CDN-droppable `<script>` that teaches any webpage to resolve `urn:dig:chia:…` and
`chia://…` references in-page — the seamless DIG protocol bridge, powered by the
canonical `@dignetwork/dig-urn-resolver` wasm engine.

## Reporting an issue

File it at https://github.com/DIG-Network/dig-web-resolver/issues.

A report is actionable when it states:

- **Observed** — what actually happened (error text, console output, the failed
  resolution).
- **Expected** — what should have happened instead.
- **Repro** — the smallest HTML/script snippet that reproduces it (which entry point:
  the inlined-wasm IIFE, the sidecar-wasm IIFE, or the ESM `activate()` call), plus the
  browser/version.

## Prerequisites

- **Node** `>=18` (`package.json` `engines.node`).
- **npm** — the repo is locked with `package-lock.json`; use `npm ci`, not `npm install`,
  to match CI exactly.
- **No local build-order dependency.** `@dignetwork/dig-urn-resolver` is consumed as an
  ordinary published npm dependency (`^0.3.1` in `package.json`) — you do not need to
  clone or build it yourself. `npm run build` runs `gen:wasm` first
  (`scripts/gen-wasm.mjs`), which pulls the wasm engine's published wasm/JS artifacts
  into this package's bundles.

## Build & test

```bash
npm ci                 # install, exactly as CI does
npm run build           # gen:wasm -> scripts/build.mjs -> tsc (emits both IIFE bundles + ESM + .d.ts)
npm run typecheck       # tsc --noEmit
npm run lint             # eslint .
npm run format:check    # prettier --check .
npm test                 # vitest run --coverage
npm run test:e2e         # playwright test (real Chromium; run `npm run build` first)
```

`test:e2e` needs a Chromium install the first time: `npx playwright install --with-deps chromium`.

## The gate

`.github/workflows/ci.yml` runs two jobs on every PR to `main`, and both must pass:

**`quality`** — in order:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test           # unit tests + coverage, gated at >=80%
npm run build       # both IIFE bundles + ESM
```

**`e2e`** — a real-browser Playwright pass:

```bash
npm ci
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Two more required checks run on every PR:

- `.github/workflows/commitlint.yml` — lints every commit message and the PR title
  against `commitlint.config.mjs` (Conventional Commits; see below).
- `.github/workflows/ensure-version-increment.yml` — fails the PR unless `package.json`'s
  `version` is strictly greater than the version on `main`.

Reproduce all of the above locally before opening a PR.

## PR conventions

- **Conventional Commits**, commitlint-enforced: `type(scope): summary`, where `type` is
  one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
  `chore`, `revert`. A breaking change appends `!` and/or a `BREAKING CHANGE:` footer.
  The PR title is linted the same way.
- **Bump `package.json`'s `version` as part of the PR** — patch for a compatible
  fix/docs/chore, minor for a compatible new capability, major for a breaking change.
  `ensure-version-increment.yml` only compares `package.json` here (this repo has no
  `Cargo.toml`).
- **`main` is protected**: branch off `main`, open a PR, get every required check green
  and every review thread resolved, then squash-merge. No direct pushes.
- **Releases are automatic on merge.** `.github/workflows/release.yml` regenerates
  `CHANGELOG.md` from your Conventional Commits (git-cliff), commits it to `main`, tags
  that commit `vX.Y.Z` from the merged `package.json` version, and pushes the tag — which
  triggers `.github/workflows/publish-npm.yml` to publish the package.
