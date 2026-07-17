import { afterEach, describe, expect, it, vi } from "vitest";
import { __setEngineForTest } from "../src/engine";
import { activate } from "../src/activate";
import { VERSION } from "../src/version";
import { fakeEngine } from "./helpers";

afterEach(() => __setEngineForTest(null));

describe("activate", () => {
  it("claims the page, scans it, and returns a live handle", async () => {
    __setEngineForTest(fakeEngine());
    const img = document.createElement("img");
    img.setAttribute("src", "urn:dig:chia:store/logo.png");
    document.body.appendChild(img);

    const handle = await activate({ wasm: new Uint8Array() });
    expect(handle).not.toBeNull();
    expect((window.__digWebResolver as { version: string }).version).toBe(VERSION);
    await vi.waitFor(() => expect(img.getAttribute("src")).toMatch(/^blob:/));
    handle!.disconnect();
  });

  it("defers (returns null, no engine use) when the page is already claimed", async () => {
    window.__digWebResolver = { claimed: true };
    const engine = fakeEngine();
    __setEngineForTest(engine);
    const img = document.createElement("img");
    img.setAttribute("src", "urn:dig:chia:store/logo.png");
    document.body.appendChild(img);

    const handle = await activate({ wasm: new Uint8Array() });
    expect(handle).toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    expect(engine.resolveImageUrl).not.toHaveBeenCalled();
    expect(img.getAttribute("src")).toBe("urn:dig:chia:store/logo.png");
  });

  it("stamps the source (page vs extension) into the claim", async () => {
    __setEngineForTest(fakeEngine());
    await activate({ wasm: new Uint8Array(), source: "extension" });
    expect((window.__digWebResolver as { source: string }).source).toBe("extension");
  });
});
