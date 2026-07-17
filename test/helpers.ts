import { vi } from "vitest";
import type { DigNetwork } from "@dignetwork/dig-urn-resolver";

/** A stand-in for the wasm engine — no wasm loads in the unit suite. */
export function fakeEngine(overrides: Partial<DigNetwork> = {}): DigNetwork {
  return {
    resolveImageUrl: vi.fn(async (ref: string) => `blob:image:${ref}`),
    resolve: vi.fn(async () => ({
      outcome: "success",
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "text/html",
    })),
    ...overrides,
  } as unknown as DigNetwork;
}

/** An engine that always fails image resolution to the branded error image. */
export const BRANDED_ERROR_IMAGE = "data:image/svg+xml;base64,ZmFpbA==";
export function failingImageEngine(): DigNetwork {
  return fakeEngine({ resolveImageUrl: vi.fn(async () => BRANDED_ERROR_IMAGE) });
}
