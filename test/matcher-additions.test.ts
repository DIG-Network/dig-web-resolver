import { describe, expect, it } from "vitest";
import { isDigRef, toEngineRef } from "../src/matcher";

describe("isDigRef — whole-value reference gate", () => {
  it("accepts a value that is ITSELF a single URN / chia reference", () => {
    expect(isDigRef("urn:dig:chia:store:root/app.js")).toBe(true);
    expect(isDigRef("chia://store:root/app.js")).toBe(true);
  });

  it("rejects a value that merely contains a reference among other text", () => {
    expect(isDigRef("prefix urn:dig:chia:store/app.js")).toBe(false);
    expect(isDigRef("/__dig/config.json")).toBe(false);
    expect(isDigRef("")).toBe(false);
    expect(isDigRef(null)).toBe(false);
  });
});

describe("toEngineRef — chia:// normalisation", () => {
  it("rewrites the chia:// prefix to the URN grammar, preserving the rest", () => {
    expect(toEngineRef("chia://store:root/app.js?salt=ff")).toBe(
      "urn:dig:chia:store:root/app.js?salt=ff",
    );
  });

  it("leaves an already-URN reference unchanged", () => {
    expect(toEngineRef("urn:dig:chia:store/app.js")).toBe("urn:dig:chia:store/app.js");
  });
});
