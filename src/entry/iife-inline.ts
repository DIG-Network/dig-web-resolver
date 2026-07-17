/**
 * Default IIFE entry — the true single-tag drop. The engine wasm is inlined as
 * base64 (no second network fetch), decoded to bytes, and handed to the engine;
 * activation runs immediately on script execution.
 */
import { activate } from "../activate";
import { WASM_BASE64 } from "../generated/wasm-inline";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

void activate({ wasm: base64ToBytes(WASM_BASE64) });
