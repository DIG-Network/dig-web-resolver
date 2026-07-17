import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setEngineForTest } from "../src/engine";
import { startObserver } from "../src/observer";
import { registerContentBlob, revokeSubtree } from "../src/blob-registry";
import { fakeEngine } from "./helpers";

// Hand out a fresh, unique blob URL per mint so revocation targets are identifiable.
let counter = 0;
let createObjectURL: ReturnType<typeof vi.spyOn>;
let revokeObjectURL: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  counter = 0;
  createObjectURL = vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:mint-${(counter += 1)}`);
  revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  __setEngineForTest(null);
  createObjectURL.mockRestore();
  revokeObjectURL.mockRestore();
});

describe("content blob-URL registry (unit)", () => {
  it("revokes the prior blob when an element's attribute is re-pointed", () => {
    const el = document.createElement("video");
    registerContentBlob(el, "src", "blob:mint-1");
    registerContentBlob(el, "src", "blob:mint-2");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mint-1");
    expect(revokeObjectURL).not.toHaveBeenCalledWith("blob:mint-2");
  });

  it("revokes every content blob in a removed subtree (node + descendants)", () => {
    const parent = document.createElement("div");
    const video = document.createElement("video");
    parent.appendChild(video);
    registerContentBlob(video, "src", "blob:mint-9");
    revokeSubtree(parent);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mint-9");
  });
});

describe("content blob-URL lifecycle (observer integration)", () => {
  it("revokes a <video src> blob when the node is removed from the document", async () => {
    __setEngineForTest(fakeEngine());
    const observer = startObserver(document);

    const video = document.createElement("video");
    video.setAttribute("src", "urn:dig:chia:store/clip.mp4");
    document.body.appendChild(video);

    await vi.waitFor(() => expect(video.getAttribute("src")).toMatch(/^blob:mint-/));
    const minted = video.getAttribute("src")!;

    video.remove();
    await vi.waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith(minted));
    observer.disconnect();
  });

  it("revokes the stale blob when a <video src> is re-pointed to a new DIG ref", async () => {
    __setEngineForTest(fakeEngine());
    const observer = startObserver(document);

    const video = document.createElement("video");
    video.setAttribute("src", "urn:dig:chia:store/first.mp4");
    document.body.appendChild(video);
    await vi.waitFor(() => expect(video.getAttribute("src")).toBe("blob:mint-1"));

    video.setAttribute("src", "urn:dig:chia:store/second.mp4");
    await vi.waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:mint-1"));
    observer.disconnect();
  });
});
