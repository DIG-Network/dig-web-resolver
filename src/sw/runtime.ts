/**
 * The Service Worker runtime — the thin glue that wires the browser's SW lifecycle
 * to the pure serve core. This is the ONE module that touches the Service Worker
 * global; all decisions and byte-handling live in the tested pure modules it composes
 * (`fetch-decision`, `serve`, `config`, `urn-path`).
 *
 * Lifecycle: `skipWaiting()` on install + `clients.claim()` on activate so a
 * freshly-registered SW takes control promptly (paired with the page-side guarded
 * one-time reload in `register.ts`). `fetch`: same-origin `GET /__dig/<urn>` →
 * verified bytes; everything else falls through to the network untouched.
 *
 * The SW-global types are declared minimally here (rather than pulling in the
 * `WebWorker` lib, which collides with the `DOM` lib this package builds against).
 */
import init, { DigNetwork } from "@dignetwork/dig-urn-resolver";
import { toEngineRef } from "../matcher";
import { engineOptionsFromQuery } from "./config";
import { digRefForRequest } from "./fetch-decision";
import { serveDigRef } from "./serve";

interface FetchEventLike {
  readonly request: Request;
  respondWith(response: Response | Promise<Response>): void;
}
interface ExtendableEventLike {
  waitUntil(promise: Promise<unknown>): void;
}
interface ServiceWorkerScope {
  readonly location: { readonly origin: string; readonly search: string };
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: "install", listener: () => void): void;
  addEventListener(type: "activate", listener: (event: ExtendableEventLike) => void): void;
  addEventListener(type: "fetch", listener: (event: FetchEventLike) => void): void;
}

/**
 * Register the dig Service Worker's lifecycle + fetch listeners. `wasm` is the engine
 * wasm (inlined as bytes by the `dig-sw.js` build); the engine is initialised lazily
 * on the first intercepted request and reused thereafter.
 */
export function installDigServiceWorker(wasm: BufferSource): void {
  const scope = self as unknown as ServiceWorkerScope;

  let enginePromise: Promise<DigNetwork> | null = null;
  const engine = (): Promise<DigNetwork> =>
    (enginePromise ??= (async () => {
      await init({ module_or_path: wasm });
      return new DigNetwork(engineOptionsFromQuery(scope.location.search));
    })());

  scope.addEventListener("install", () => {
    void scope.skipWaiting();
  });

  scope.addEventListener("activate", (event) => {
    event.waitUntil(scope.clients.claim());
  });

  scope.addEventListener("fetch", (event) => {
    const ref = digRefForRequest(event.request.method, event.request.url, scope.location.origin);
    if (ref === null) return; // pass through to the network — not a dig request
    event.respondWith(engine().then((dig) => serveDigRef(dig, toEngineRef(ref))));
  });
}
