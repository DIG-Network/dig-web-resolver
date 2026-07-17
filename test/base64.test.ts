import { describe, expect, it } from "vitest";
import { base64ToBytes } from "../src/base64";

describe("base64ToBytes", () => {
  it("decodes base64 to the exact bytes over a concrete ArrayBuffer", () => {
    const bytes = base64ToBytes(btoa("dig"));
    expect(Array.from(bytes)).toEqual([100, 105, 103]);
    expect(bytes.buffer).toBeInstanceOf(ArrayBuffer);
  });

  it("returns an empty view for an empty string", () => {
    expect(base64ToBytes("").length).toBe(0);
  });
});
