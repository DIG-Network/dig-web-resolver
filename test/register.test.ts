import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RELOAD_GUARD_KEY,
  registerDigSW,
  shouldReloadToControl,
} from "../src/sw/register";

/** Install a fake `navigator.serviceWorker` with the given controller state. */
function fakeServiceWorker(controller: object | null): { register: ReturnType<typeof vi.fn> } {
  const registration = { scope: "/" } as ServiceWorkerRegistration;
  const container = {
    register: vi.fn(async () => registration),
    ready: Promise.resolve(registration),
    controller,
  };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });
  return container;
}

function setSecureContext(value: boolean): void {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value });
}

afterEach(() => {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("shouldReloadToControl", () => {
  it("reloads only when uncontrolled, allowed, and not yet reloaded", () => {
    expect(shouldReloadToControl(false, true, false)).toBe(true);
    expect(shouldReloadToControl(true, true, false)).toBe(false); // already controlled
    expect(shouldReloadToControl(false, false, false)).toBe(false); // disabled
    expect(shouldReloadToControl(false, true, true)).toBe(false); // already reloaded once
  });
});

describe("registerDigSW", () => {
  it("returns null in an insecure context (SW cannot register)", async () => {
    setSecureContext(false);
    expect(await registerDigSW()).toBeNull();
  });

  it("returns null when the browser has no serviceWorker support", async () => {
    setSecureContext(true);
    expect(await registerDigSW()).toBeNull();
  });

  it("registers as a module SW at scope / and reports control when already controlling", async () => {
    setSecureContext(true);
    const container = fakeServiceWorker({});
    const result = await registerDigSW();

    expect(container.register).toHaveBeenCalledWith("/dig-sw.js", { scope: "/", type: "module" });
    expect(result).not.toBeNull();
    expect(result!.controlled).toBe(true);
    expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).toBeNull();
  });

  it("performs a single guarded reload on the first uncontrolled load", async () => {
    setSecureContext(true);
    fakeServiceWorker(null);
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);

    const result = await registerDigSW();

    expect(result).toBeNull(); // navigation is about to replace the page
    expect(reload).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).toBe("1");
  });

  it("does not reload twice — after the guard is set it returns uncontrolled", async () => {
    setSecureContext(true);
    fakeServiceWorker(null);
    sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);

    const result = await registerDigSW();

    expect(reload).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.controlled).toBe(false);
  });

  it("honours reloadToControl:false (never reloads)", async () => {
    setSecureContext(true);
    fakeServiceWorker(null);
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);

    const result = await registerDigSW({ reloadToControl: false });

    expect(reload).not.toHaveBeenCalled();
    expect(result!.controlled).toBe(false);
  });
});
