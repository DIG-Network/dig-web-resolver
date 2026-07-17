import { describe, expect, it } from "vitest";
import { engineOptionsFromQuery } from "../src/sw/config";

describe("engineOptionsFromQuery — dig-sw.js registration query", () => {
  it("reads the endpoint and connectUrl overrides", () => {
    expect(engineOptionsFromQuery("?endpoint=https://dig.local&connectUrl=https://x")).toEqual({
      endpoint: "https://dig.local",
      connectUrl: "https://x",
    });
  });

  it("returns empty options for an empty query (all §5.3 defaults)", () => {
    expect(engineOptionsFromQuery("")).toEqual({});
  });

  it("ignores unknown params and blank values", () => {
    expect(engineOptionsFromQuery("?store=abc&endpoint=")).toEqual({});
  });
});
