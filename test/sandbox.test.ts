import { afterEach, describe, expect, it, vi } from "vitest";
import { openInSandbox } from "../src/sandbox";

afterEach(() => document.getElementById("dig-web-resolver-overlay")?.remove());

describe("opaque-origin sandbox viewer", () => {
  it("mounts an iframe sandboxed to EXACTLY allow-scripts (opaque, no outward reach)", () => {
    openInSandbox("blob:content", "chia://store/page");
    const overlay = document.getElementById("dig-web-resolver-overlay")!;
    const frame = overlay.querySelector("iframe")!;
    // Exact token set: scripts to render, but no same-origin, no popups, no forms.
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("src")).toBe("blob:content");
    expect(overlay.getAttribute("role")).toBe("dialog");
  });

  it("offers an escape hatch: the close button dismisses and revokes the blob URL", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    openInSandbox("blob:content", "chia://store/page");
    const button = document.querySelector<HTMLButtonElement>("#dig-web-resolver-overlay button")!;
    button.click();
    expect(document.getElementById("dig-web-resolver-overlay")).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:content");
    revoke.mockRestore();
  });

  it("closes on the Escape key", () => {
    openInSandbox("blob:content", "chia://store/page");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("dig-web-resolver-overlay")).toBeNull();
  });
});
