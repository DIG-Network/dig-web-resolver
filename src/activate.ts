/**
 * Activation — the one entry every build funnels through. The order is load-bearing:
 *
 *   1. Claim the coexistence sentinel SYNCHRONOUSLY (before the first `await`), so a
 *      second loader on the page defers with zero side effects.
 *   2. Only if we won the claim: initialise the wasm engine, do the full-document
 *      scan, start the MutationObserver, and install the link interceptor.
 */
import type { DigNetworkOptions } from "@dignetwork/dig-urn-resolver";
import { type ClaimSource, tryClaim } from "./sentinel";
import { type WasmSource, initEngine } from "./engine";
import { scanSubtree } from "./scanner";
import { startObserver } from "./observer";
import { installLinkInterceptor } from "./links";
import { serviceWorkerControlsPage } from "./sw/coexist";
import { VERSION } from "./version";

export interface ActivateOptions {
  /** How the engine's wasm reaches us: inlined bytes, a sidecar URL, or a module. */
  wasm: WasmSource;
  /** Who is activating — `"page"` (default) or `"extension"` (WU2). */
  source?: ClaimSource;
  /** Forwarded to the engine (endpoint override, connect URL, …). */
  engine?: DigNetworkOptions;
}

/** A live activation; `disconnect()` stops the observer and link interceptor. */
export interface ActivationHandle {
  readonly observer: MutationObserver;
  disconnect(): void;
}

/**
 * Activate the resolver on the current page.
 *
 * @returns an {@link ActivationHandle} if this instance won the sentinel claim, or
 *   `null` if the page was already claimed (this instance deferred — no scan, no
 *   observer, no wasm init).
 */
export async function activate(options: ActivateOptions): Promise<ActivationHandle | null> {
  // (1) Synchronous claim — decided before any await yields the event loop. The mode
  // records whether a Tier-2 SW controls the page (so the scanner defers content
  // surfaces to it — see scanner.ts) or the DOM loader owns everything (Tier 1).
  const mode = serviceWorkerControlsPage() ? "sw" : "dom";
  if (!tryClaim(VERSION, options.source ?? "page", mode)) return null;

  // (2) We own the page: bring up the engine and wire the DOM.
  await initEngine(options.wasm, options.engine);
  scanSubtree(document.documentElement);
  const observer = startObserver(document);
  const removeLinkInterceptor = installLinkInterceptor(document);

  return {
    observer,
    disconnect() {
      observer.disconnect();
      removeLinkInterceptor();
    },
  };
}
