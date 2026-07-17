/**
 * Service Worker entry — bundled to `dist/dig-sw.js`. It inlines the engine wasm as
 * base64 (a self-contained module SW, no second network fetch), then wires the
 * install/activate/fetch lifecycle. A site self-hosts this file at its own origin and
 * registers it via {@link registerDigSW} (SW scripts must be same-origin).
 */
import { installDigServiceWorker } from "../sw/runtime";
import { WASM_BASE64 } from "../generated/wasm-inline";
import { base64ToBytes } from "../base64";

installDigServiceWorker(base64ToBytes(WASM_BASE64));
