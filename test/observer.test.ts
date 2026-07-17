import { afterEach, describe, expect, it, vi } from "vitest";
import { __setEngineForTest } from "../src/engine";
import { startObserver } from "../src/observer";
import { fakeEngine } from "./helpers";

afterEach(() => __setEngineForTest(null));

describe("MutationObserver", () => {
  it("resolves a DIG node added after activation", async () => {
    __setEngineForTest(fakeEngine());
    const observer = startObserver(document);

    const img = document.createElement("img");
    img.setAttribute("src", "urn:dig:chia:store/late.png");
    document.body.appendChild(img);

    await vi.waitFor(() => expect(img.getAttribute("src")).toMatch(/^blob:image:/));
    observer.disconnect();
  });

  it("resolves a DIG reference set on a watched attribute after mount", async () => {
    __setEngineForTest(fakeEngine());
    const img = document.createElement("img");
    document.body.appendChild(img);
    const observer = startObserver(document);

    img.setAttribute("src", "chia://store/changed.png");
    await vi.waitFor(() => expect(img.getAttribute("src")).toMatch(/^blob:image:/));
    observer.disconnect();
  });
});
