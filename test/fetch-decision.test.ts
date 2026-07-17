import { describe, expect, it } from "vitest";
import { digRefForRequest } from "../src/sw/fetch-decision";
import { digPathFor } from "../src/sw/urn-path";

const ORIGIN = "https://mydigsite.example";

describe("digRefForRequest — the SW fetch decision", () => {
  it("returns the reference for a same-origin GET of a /__dig/<urn> path", () => {
    const url = ORIGIN + digPathFor("urn:dig:chia:store:root/app.js");
    expect(digRefForRequest("GET", url, ORIGIN)).toBe("urn:dig:chia:store:root/app.js");
  });

  it("passes through non-GET methods", () => {
    const url = ORIGIN + digPathFor("urn:dig:chia:store:root/app.js");
    expect(digRefForRequest("POST", url, ORIGIN)).toBeNull();
    expect(digRefForRequest("HEAD", url, ORIGIN)).toBeNull();
  });

  it("passes through cross-origin requests (SW only serves its own origin)", () => {
    const url = "https://evil.example" + digPathFor("urn:dig:chia:store:root/app.js");
    expect(digRefForRequest("GET", url, ORIGIN)).toBeNull();
  });

  it("passes through ordinary same-origin assets", () => {
    expect(digRefForRequest("GET", ORIGIN + "/assets/app.js", ORIGIN)).toBeNull();
    expect(digRefForRequest("GET", ORIGIN + "/__dig/config.json", ORIGIN)).toBeNull();
  });
});
