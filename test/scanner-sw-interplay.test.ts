import { afterEach, describe, expect, it, vi } from "vitest";
import { scanSubtree } from "../src/scanner";
import { __setEngineForTest } from "../src/engine";
import { DIG_PATH_PREFIX } from "../src/sw/urn-path";
import { fakeEngine } from "./helpers";

/** Let the scanner's fire-and-forget async resolution settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function setServiceWorkerController(controller: object | null): void {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { controller },
  });
}

afterEach(() => {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  __setEngineForTest(null);
  vi.restoreAllMocks();
});

describe("scanner Tier-1 ↔ Tier-2 interplay (no double-resolve)", () => {
  it("rewrites a stylesheet href to a /__dig/ path when a SW controls the page", async () => {
    setServiceWorkerController({}); // Tier 2 active
    const engine = fakeEngine();
    __setEngineForTest(engine);

    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", "urn:dig:chia:store:root/app.css");
    document.head.appendChild(link);

    scanSubtree(document.documentElement);
    await flush();

    // The SW will serve it natively; the DOM loader must NOT blob-swap it.
    expect(link.getAttribute("href")!.startsWith(DIG_PATH_PREFIX)).toBe(true);
    expect(engine.resolve).not.toHaveBeenCalled();
  });

  it("blob-swaps a stylesheet href (Tier 1) when no SW controls the page", async () => {
    setServiceWorkerController(null); // Tier 1 only
    const engine = fakeEngine();
    __setEngineForTest(engine);

    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", "urn:dig:chia:store:root/app.css");
    document.head.appendChild(link);

    scanSubtree(document.documentElement);
    await flush();

    expect(link.getAttribute("href")!.startsWith(DIG_PATH_PREFIX)).toBe(false);
    expect(engine.resolve).toHaveBeenCalledOnce();
  });
});
