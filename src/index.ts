/**
 * `@dignetwork/dig-web-resolver` — the public ESM surface.
 *
 * The IIFE builds auto-activate on load; ESM consumers call {@link activate}
 * themselves (providing the wasm source their bundler emits).
 */
export { activate, type ActivateOptions, type ActivationHandle } from "./activate";
export { VERSION } from "./version";
export {
  tryClaim,
  type ClaimSource,
  type DigWebResolverClaim,
  type ResolverMode,
} from "./sentinel";
export { type WasmSource } from "./engine";

// Tier 2 — the Service Worker mode. `registerDigSW` is the page-side adoption helper
// a self-hosting site calls; `installDigServiceWorker` is what the bundled
// `dist/dig-sw.js` runs. `DIG_PATH_PREFIX`/`digPathFor` are the `/__dig/<urn>` path
// convention the SW intercepts.
export {
  registerDigSW,
  shouldReloadToControl,
  RELOAD_GUARD_KEY,
  type RegisterDigSWOptions,
  type DigSWRegistrationResult,
} from "./sw/register";
export { installDigServiceWorker } from "./sw/runtime";
export { serveDigRef, DIG_RESPONSE_CSP, type ResolveEngine } from "./sw/serve";
export { DIG_PATH_PREFIX, digPathFor, digRefFromPath } from "./sw/urn-path";
