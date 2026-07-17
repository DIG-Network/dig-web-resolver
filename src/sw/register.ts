/**
 * `registerDigSW()` — the page-side helper a self-hosting site calls to adopt Tier 2.
 *
 * A Service Worker MUST be same-origin: a CDN snippet cannot register a dig.net SW
 * onto a third-party page, so SW mode is ALWAYS adopt-by-self-hosting — the site
 * copies `dig-sw.js` to its own origin and calls this. It registers as a module SW at
 * `scope:"/"`, waits for readiness, and — on the very first (uncontrolled) load —
 * performs ONE guarded reload so the SW gains control and can intercept the page's
 * own parse-time subresource fetches on the controlled load.
 *
 * Honest limitation: the first uncontrolled load's parse-time subresources are NOT
 * intercepted until the guarded reload takes control; steady-state is full fidelity.
 */

/** Session-storage key guarding the one-time first-load reload (no reload loop). */
export const RELOAD_GUARD_KEY = "__dig_sw_reloaded";

/** Options for {@link registerDigSW}; every field has a sensible default. */
export interface RegisterDigSWOptions {
  /** The self-hosted SW script URL (same-origin). Default `"/dig-sw.js"`. */
  url?: string;
  /** The control scope. Default `"/"` (the whole origin). */
  scope?: string;
  /** Perform the guarded first-load reload to gain control. Default `true`. */
  reloadToControl?: boolean;
}

/** The outcome of a registration attempt. */
export interface DigSWRegistrationResult {
  /** The live registration. */
  readonly registration: ServiceWorkerRegistration;
  /** Whether the SW already controls this page (steady state). */
  readonly controlled: boolean;
}

/**
 * Decide whether to perform the one-time reload: only when the SW is not yet
 * controlling this client, the caller allowed it, and we have not already reloaded
 * once this session. Pure so the guard logic is unit-tested directly.
 */
export function shouldReloadToControl(
  controlled: boolean,
  reloadToControl: boolean,
  alreadyReloaded: boolean,
): boolean {
  return !controlled && reloadToControl && !alreadyReloaded;
}

/**
 * Register the dig Service Worker on the current (secure-context) page.
 *
 * @returns the registration result, or `null` when the environment cannot support a
 *   SW (insecure context / no `serviceWorker`) or when a first-load reload is about
 *   to replace the page.
 */
export async function registerDigSW(
  options: RegisterDigSWOptions = {},
): Promise<DigSWRegistrationResult | null> {
  if (!self.isSecureContext || !("serviceWorker" in navigator)) return null;

  const url = options.url ?? "/dig-sw.js";
  const scope = options.scope ?? "/";
  const reloadToControl = options.reloadToControl ?? true;

  const registration = await navigator.serviceWorker.register(url, { scope, type: "module" });
  await navigator.serviceWorker.ready;

  const controlled = !!navigator.serviceWorker.controller;
  const alreadyReloaded = sessionStorage.getItem(RELOAD_GUARD_KEY) === "1";

  if (shouldReloadToControl(controlled, reloadToControl, alreadyReloaded)) {
    sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
    location.reload();
    return null; // navigation is about to replace the page
  }

  if (controlled) sessionStorage.removeItem(RELOAD_GUARD_KEY);
  return { registration, controlled };
}
