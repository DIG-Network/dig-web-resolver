/**
 * External-wasm IIFE entry — for size-sensitive embeds. The engine wasm ships as a
 * sidecar `dig-web-resolver.wasm` served next to this script; we derive its URL
 * from the executing `<script>` element and let the engine fetch it.
 */
import { activate } from "../activate";

function sidecarWasmUrl(): URL {
  const current = document.currentScript as HTMLScriptElement | null;
  const base = current?.src ?? window.location.href;
  return new URL("dig-web-resolver.wasm", base);
}

void activate({ wasm: sidecarWasmUrl() });
