/**
 * The thin wrapper around the canonical `@dignetwork/dig-urn-resolver` wasm engine.
 *
 * This module deliberately owns NO crypto, NO fetch, and NO trust logic — the
 * engine performs the §5.3 node-first ladder, merkle verification, and fail-closed
 * decryption. We only (a) initialise the wasm once and (b) turn the engine's
 * verified results into URLs the DOM can consume. Every failure path here yields a
 * BRANDED engine artifact, never unverified bytes.
 */
import init, { DigNetwork, type DigNetworkOptions } from "@dignetwork/dig-urn-resolver";
import { toEngineRef } from "./matcher";

/** How the wasm bytes reach the engine: inlined bytes, a sidecar URL, or a module. */
export type WasmSource = BufferSource | URL | string | WebAssembly.Module | Response;

let engine: DigNetwork | null = null;

/**
 * Initialise the wasm engine exactly once. Safe to await repeatedly; a second call
 * is a no-op once the engine is live.
 */
export async function initEngine(wasm: WasmSource, options: DigNetworkOptions = {}): Promise<void> {
  if (engine) return;
  await init({ module_or_path: wasm });
  engine = new DigNetwork(options);
}

/** For tests: inject a ready engine (bypasses wasm init). */
export function __setEngineForTest(fake: DigNetwork | null): void {
  engine = fake;
}

function requireEngine(): DigNetwork {
  if (!engine) throw new Error("dig-web-resolver: engine used before initEngine()");
  return engine;
}

/**
 * Re-exported for callers that resolve through this wrapper. The normalisation
 * itself is a pure string rewrite (no wasm) and lives in {@link module:matcher}.
 */
export { toEngineRef } from "./matcher";

/**
 * Resolve a DIG reference to a URL for an IMAGE context (`<img>`, `srcset`, icons,
 * CSS `background-image`). Delegates to the engine's `resolveImageUrl`, which
 * ALWAYS returns a usable URL: a `blob:` of the real verified image on success, or
 * a STATIC branded DIG error image on ANY failure — never the unverified bytes.
 */
export async function resolveImageUrl(ref: string): Promise<string> {
  return requireEngine().resolveImageUrl(toEngineRef(ref));
}

/**
 * Resolve a DIG reference to a `blob:` URL for a CONTENT context (stylesheet, media,
 * or link-target document). On success the blob carries the verified bytes under
 * their real content type; on ANY failure the engine returns the branded `text/html`
 * page as the bytes — so this is fail-closed (a caller can only ever surface verified
 * content or the branded page, never unverified bytes).
 */
export async function resolveContentUrl(ref: string): Promise<string> {
  const result = await requireEngine().resolve(toEngineRef(ref));
  // Copy into a fresh ArrayBuffer-backed view so the bytes satisfy `BlobPart`.
  const blob = new Blob([new Uint8Array(result.bytes)], { type: result.contentType });
  return URL.createObjectURL(blob);
}
