import { afterEach, describe, expect, it, vi } from "vitest";
import { __setEngineForTest } from "../src/engine";
import { scanSubtree } from "../src/scanner";
import { BRANDED_ERROR_IMAGE, fakeEngine, failingImageEngine } from "./helpers";

afterEach(() => __setEngineForTest(null));

describe("DOM scanner", () => {
  it("resolves a DIG <img src> to the engine's verified URL", async () => {
    __setEngineForTest(fakeEngine());
    const img = document.createElement("img");
    img.setAttribute("src", "urn:dig:chia:store/logo.png");
    document.body.appendChild(img);

    scanSubtree(document.documentElement);
    await vi.waitFor(() => expect(img.getAttribute("src")).toBe("blob:image:urn:dig:chia:store/logo.png"));
  });

  it("leaves a non-DIG <img src> untouched", async () => {
    const engine = fakeEngine();
    __setEngineForTest(engine);
    const img = document.createElement("img");
    img.setAttribute("src", "https://cdn.example/logo.png");
    document.body.appendChild(img);

    scanSubtree(document.documentElement);
    await new Promise((r) => setTimeout(r, 5));
    expect(img.getAttribute("src")).toBe("https://cdn.example/logo.png");
    expect(engine.resolveImageUrl).not.toHaveBeenCalled();
  });

  it("shows the branded error image when the engine fails (fail-closed)", async () => {
    __setEngineForTest(failingImageEngine());
    const img = document.createElement("img");
    img.setAttribute("src", "chia://store/missing.png");
    document.body.appendChild(img);

    scanSubtree(document.documentElement);
    await vi.waitFor(() => expect(img.getAttribute("src")).toBe(BRANDED_ERROR_IMAGE));
  });

  it("rewrites DIG url(...) inside an author-set style attribute", async () => {
    __setEngineForTest(fakeEngine());
    const div = document.createElement("div");
    div.setAttribute("style", 'background-image:url("urn:dig:chia:store/bg.png")');
    document.body.appendChild(div);

    scanSubtree(document.documentElement);
    await vi.waitFor(() =>
      expect(div.getAttribute("style")).toBe('background-image:url("blob:image:urn:dig:chia:store/bg.png")'),
    );
  });

  it("resolves a <picture> <source srcset> as an image", async () => {
    __setEngineForTest(fakeEngine());
    const picture = document.createElement("picture");
    const source = document.createElement("source");
    source.setAttribute("srcset", "urn:dig:chia:store/hero.avif");
    picture.appendChild(source);
    document.body.appendChild(picture);

    scanSubtree(document.documentElement);
    await vi.waitFor(() => expect(source.getAttribute("srcset")).toMatch(/^blob:image:/));
  });

  it("resolves a <video src> and <link rel=stylesheet href> as content blobs", async () => {
    __setEngineForTest(fakeEngine({ resolveImageUrl: vi.fn(async () => "blob:img") }));
    const video = document.createElement("video");
    video.setAttribute("src", "urn:dig:chia:store/clip.mp4");
    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", "chia://store/theme.css");
    document.body.append(video, link);

    scanSubtree(document.documentElement);
    await vi.waitFor(() => {
      expect(video.getAttribute("src")).toMatch(/^blob:/);
      expect(link.getAttribute("href")).toMatch(/^blob:/);
    });
  });

  it("resolves DIG url(...) inside a <style> element and a rel=icon link", async () => {
    __setEngineForTest(fakeEngine());
    const style = document.createElement("style");
    style.textContent = '.a{background:url("urn:dig:chia:store/tile.png")}';
    const icon = document.createElement("link");
    icon.setAttribute("rel", "icon");
    icon.setAttribute("href", "urn:dig:chia:store/favicon.png");
    document.head.append(style, icon);

    scanSubtree(document.documentElement);
    await vi.waitFor(() => {
      expect(style.textContent).toContain("blob:image:");
      expect(icon.getAttribute("href")).toMatch(/^blob:image:/);
    });
  });

  it("NEVER touches or executes a <script src=urn:…> (security exclusion)", async () => {
    const engine = fakeEngine();
    __setEngineForTest(engine);
    const script = document.createElement("script");
    const digSrc = "urn:dig:chia:store/app.js";
    script.setAttribute("src", digSrc);
    document.body.appendChild(script);

    scanSubtree(document.documentElement);
    await new Promise((r) => setTimeout(r, 5));
    // The src is left verbatim; the engine is never asked to resolve executable JS.
    expect(script.getAttribute("src")).toBe(digSrc);
    expect(engine.resolveImageUrl).not.toHaveBeenCalled();
    expect(engine.resolve).not.toHaveBeenCalled();
  });

  it("does not reprocess an already-resolved node (guard)", async () => {
    // A real blob URL does not embed the original ref, so the resolved value no
    // longer matches — the natural re-scan guard.
    const engine = fakeEngine({ resolveImageUrl: vi.fn(async () => "blob:resolved") });
    __setEngineForTest(engine);
    const img = document.createElement("img");
    img.setAttribute("src", "urn:dig:chia:store/logo.png");
    document.body.appendChild(img);

    scanSubtree(document.documentElement);
    await vi.waitFor(() => expect(img.getAttribute("src")).toMatch(/^blob:/));
    scanSubtree(document.documentElement); // second pass — value no longer a DIG ref
    await new Promise((r) => setTimeout(r, 5));
    expect(engine.resolveImageUrl).toHaveBeenCalledTimes(1);
  });
});
