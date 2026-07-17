import { describe, expect, it } from "vitest";
import { DIG_PATH_PREFIX, digPathFor, digRefFromPath } from "../src/sw/urn-path";

describe("the /__dig/<url-encoded-urn> path convention", () => {
  it("encodes a URN reference into a single /__dig/ path segment", () => {
    const path = digPathFor("urn:dig:chia:store:root/app.js");
    expect(path.startsWith(DIG_PATH_PREFIX)).toBe(true);
    expect(path).toBe("/__dig/" + encodeURIComponent("urn:dig:chia:store:root/app.js"));
  });

  it("normalises a chia:// reference to the engine URN grammar before encoding", () => {
    const path = digPathFor("chia://store:root/app.js");
    expect(digRefFromPath(path)).toBe("urn:dig:chia:store:root/app.js");
  });

  it("round-trips: decoding an encoded path yields the original URN", () => {
    const urn = "urn:dig:chia:abc123:deadbeef/dir/app.js?salt=00ff";
    expect(digRefFromPath(digPathFor(urn))).toBe(urn);
  });

  it("returns null for a path outside the /__dig/ prefix (pass-through)", () => {
    expect(digRefFromPath("/assets/app.js")).toBeNull();
    expect(digRefFromPath("/")).toBeNull();
  });

  it("passes through /__dig/ control paths whose segment is NOT a dig reference", () => {
    // e.g. a future config/asset endpoint under the reserved prefix.
    expect(digRefFromPath("/__dig/config.json")).toBeNull();
    expect(digRefFromPath("/__dig/")).toBeNull();
  });

  it("fail-closed: a malformed percent-escape yields null (not intercepted)", () => {
    expect(digRefFromPath("/__dig/%E0%A4%A")).toBeNull();
  });
});
