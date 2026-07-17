import { describe, expect, it } from "vitest";
import { containsDigRef, replaceCssUrls, replaceDigRefs } from "../src/matcher";

const URN = "urn:dig:chia:abc123/img/logo.png";
const CHIA = "chia://abc123/index.html";

describe("containsDigRef", () => {
  it("detects urn:dig:chia: and chia:// references", () => {
    expect(containsDigRef(URN)).toBe(true);
    expect(containsDigRef(CHIA)).toBe(true);
    expect(containsDigRef(`CHIA://ABC/x`)).toBe(true);
  });

  it("ignores non-DIG references and empty values", () => {
    expect(containsDigRef("https://example.com/a.png")).toBe(false);
    expect(containsDigRef("/local/asset.png")).toBe(false);
    expect(containsDigRef("")).toBe(false);
    expect(containsDigRef(null)).toBe(false);
    expect(containsDigRef(undefined)).toBe(false);
  });
});

describe("replaceDigRefs", () => {
  const stub = async (ref: string) => `blob:${ref}`;

  it("replaces only the DIG token, preserving srcset descriptors + other urls", async () => {
    const srcset = `${URN} 1x, https://cdn/x.png 2x`;
    const out = await replaceDigRefs(srcset, stub);
    expect(out).toBe(`blob:${URN} 1x, https://cdn/x.png 2x`);
  });

  it("returns the value unchanged when there is no DIG reference", async () => {
    expect(await replaceDigRefs("https://cdn/x.png", stub)).toBe("https://cdn/x.png");
  });

  it("resolves a repeated reference once", async () => {
    let calls = 0;
    const counting = async (ref: string) => {
      calls += 1;
      return `blob:${ref}`;
    };
    await replaceDigRefs(`${URN} ${URN}`, counting);
    expect(calls).toBe(1);
  });
});

describe("replaceCssUrls", () => {
  const stub = async (ref: string) => `blob:${ref}`;

  it("rewrites only DIG url(...) targets, leaving other declarations intact", async () => {
    const css = `background:url("${URN}");color:red;mask:url(https://cdn/x.svg)`;
    const out = await replaceCssUrls(css, stub);
    expect(out).toBe(`background:url("blob:${URN}");color:red;mask:url(https://cdn/x.svg)`);
  });

  it("leaves CSS without a DIG url untouched", async () => {
    const css = "background:url(https://cdn/x.png)";
    expect(await replaceCssUrls(css, stub)).toBe(css);
  });
});
