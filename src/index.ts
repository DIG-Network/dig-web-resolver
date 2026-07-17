/**
 * `@dignetwork/dig-web-resolver` — the public ESM surface.
 *
 * The IIFE builds auto-activate on load; ESM consumers call {@link activate}
 * themselves (providing the wasm source their bundler emits).
 */
export { activate, type ActivateOptions, type ActivationHandle } from "./activate";
export { VERSION } from "./version";
export { tryClaim, type ClaimSource, type DigWebResolverClaim } from "./sentinel";
export { type WasmSource } from "./engine";
