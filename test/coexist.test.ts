import { afterEach, describe, expect, it } from "vitest";
import { serviceWorkerControlsPage } from "../src/sw/coexist";

afterEach(() => {
  // Remove any fake serviceWorker we installed on the jsdom navigator.
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

describe("serviceWorkerControlsPage", () => {
  it("is false when navigator has no serviceWorker (jsdom default)", () => {
    expect(serviceWorkerControlsPage()).toBe(false);
  });

  it("is false when a serviceWorker exists but nothing controls the page", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { controller: null },
    });
    expect(serviceWorkerControlsPage()).toBe(false);
  });

  it("is true when a serviceWorker controls the page", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { controller: {} },
    });
    expect(serviceWorkerControlsPage()).toBe(true);
  });
});
