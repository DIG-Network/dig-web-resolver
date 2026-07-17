/**
 * Decode a base64 string to raw bytes — shared by the two inline-wasm builds (the
 * IIFE DOM loader and the Service Worker), both of which embed the engine wasm as
 * base64 so each is a single self-contained file with no second network fetch.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
