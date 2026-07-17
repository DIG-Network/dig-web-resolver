// Produce the three distributable bundles from one TypeScript source via esbuild:
//   • dist/dig-web-resolver.iife.js               — default IIFE, wasm inlined (single-tag drop)
//   • dist/dig-web-resolver.iife.external-wasm.js  — IIFE + sidecar dig-web-resolver.wasm
//   • dist/dig-web-resolver.esm.js                 — ESM for bundler consumers
import { build } from "esbuild";
import { readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

// The engine's default init path references `new URL(..._bg.wasm, import.meta.url)`.
// We ALWAYS pass explicit wasm, so that branch is dead — defining `import.meta.url`
// away stops esbuild treating it as an asset (no stray hashed .wasm) and lets the
// IIFE format build (which cannot use `import.meta`).
const define = {
  __DWR_VERSION__: JSON.stringify(pkg.version),
  "import.meta.url": '""',
};

const shared = { bundle: true, platform: "browser", target: "es2020", define, logLevel: "warning" };

await build({
  ...shared,
  entryPoints: [resolve(root, "src/entry/iife-inline.ts")],
  outfile: resolve(root, "dist/dig-web-resolver.iife.js"),
  format: "iife",
  minify: true,
});

await build({
  ...shared,
  entryPoints: [resolve(root, "src/entry/iife-external.ts")],
  outfile: resolve(root, "dist/dig-web-resolver.iife.external-wasm.js"),
  format: "iife",
  minify: true,
});

await build({
  ...shared,
  entryPoints: [resolve(root, "src/index.ts")],
  outfile: resolve(root, "dist/dig-web-resolver.esm.js"),
  format: "esm",
});

// Tier 2 — the self-hosted module Service Worker (wasm inlined; a site copies this to
// its own origin and registers it via registerDigSW). Must be an ES module (the SW is
// registered with `{ type: "module" }`).
await build({
  ...shared,
  entryPoints: [resolve(root, "src/entry/sw.ts")],
  outfile: resolve(root, "dist/dig-sw.js"),
  format: "esm",
  minify: true,
});

// The sidecar wasm for the external-wasm build.
const wasmSrc = resolve(root, "node_modules/@dignetwork/dig-urn-resolver/web/dig_urn_resolver_bg.wasm");
const wasmOut = resolve(root, "dist/dig-web-resolver.wasm");
copyFileSync(wasmSrc, wasmOut);

const kib = (p) => `${(statSync(p).size / 1024).toFixed(1)} KiB`;
writeFileSync(
  resolve(root, "dist/BUILD_SIZES.txt"),
  [
    `iife (inline wasm):     ${kib(resolve(root, "dist/dig-web-resolver.iife.js"))}`,
    `iife (external wasm):   ${kib(resolve(root, "dist/dig-web-resolver.iife.external-wasm.js"))}`,
    `  + sidecar wasm:       ${kib(wasmOut)}`,
    `esm:                    ${kib(resolve(root, "dist/dig-web-resolver.esm.js"))}`,
    `sw (inline wasm):       ${kib(resolve(root, "dist/dig-sw.js"))}`,
    "",
  ].join("\n"),
);
console.log(readFileSync(resolve(root, "dist/BUILD_SIZES.txt"), "utf8"));
