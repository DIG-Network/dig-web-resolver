/**
 * Default IIFE entry — the true single-tag drop. The engine wasm is inlined as
 * base64 (no second network fetch), decoded to bytes, and handed to the engine;
 * activation runs immediately on script execution.
 */
import { activate } from "../activate";
import { WASM_BASE64 } from "../generated/wasm-inline";
import { base64ToBytes } from "../base64";

void activate({ wasm: base64ToBytes(WASM_BASE64) });
