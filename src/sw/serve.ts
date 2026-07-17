/**
 * The fail-closed serve core — turns a DIG reference into an HTTP `Response` the
 * browser executes/applies NATIVELY (a `<script>`, a `<link rel=stylesheet>`, a
 * font), by delegating to the canonical engine and surfacing ONLY its verified
 * result. This module owns NO crypto, NO fetch, NO trust logic; the engine performs
 * the §5.3 ladder, merkle verification, and fail-closed decryption.
 *
 * Security invariants (each enforced below, each covered by a test):
 *  - Unverified bytes are NEVER returned with a success status or an executable
 *    content type. A non-`success` outcome returns the engine's BRANDED `text/html`
 *    page under a non-2xx status — so the browser will not run/apply it as script or
 *    style (wrong MIME + `nosniff` + non-2xx).
 *  - Every response is `nosniff`, so a `text/html` failure body can never be
 *    MIME-sniffed back into executable script.
 *  - A Service-Worker-synthesized response inherits NO edge CSP, so we set our own.
 */
import type { DigNetwork } from "@dignetwork/dig-urn-resolver";

/** The engine surface this module needs — narrowed so unit tests fake it trivially. */
export type ResolveEngine = Pick<DigNetwork, "resolve">;

/**
 * The store-content CSP applied to every SW-synthesized dig response. It locks the
 * served document to its own resources: no ambient host script, framing, or form
 * posting — the same isolation the DOM loader's opaque-origin link sandbox gives.
 */
export const DIG_RESPONSE_CSP = [
  "default-src 'self' blob: data:",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src https://dig.local https://localhost:9778 https://rpc.dig.net",
  "frame-ancestors 'self'",
  "form-action 'self'",
].join("; ");

/** HTTP status codes the serve core maps each engine outcome to. */
const STATUS = {
  integrityFailure: 409, // Conflict — the bytes did not verify against the root.
  unreachable: 503, // Service Unavailable — no §5.3 tier responded.
  hardError: 502, // Bad Gateway — bad URN / not found / RootRequired over rpc.
} as const;

function headersFor(contentType: string): Headers {
  return new Headers({
    "content-type": contentType,
    "x-content-type-options": "nosniff",
    "content-security-policy": DIG_RESPONSE_CSP,
  });
}

/** Copy engine bytes into a fresh `ArrayBuffer` so they satisfy `BodyInit` under
 *  strict typing (the engine's `Uint8Array` may be backed by a `SharedArrayBuffer`). */
function body(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/**
 * Resolve `urn` through the engine and return the HTTP `Response` for it. The `urn`
 * MUST already be in the engine's canonical grammar (callers normalise via
 * `toEngineRef`). Never throws — a hard engine error becomes a branded 502.
 */
export async function serveDigRef(engine: ResolveEngine, urn: string): Promise<Response> {
  let result;
  try {
    result = await engine.resolve(urn);
  } catch {
    // Hard error (bad URN, not-found, RootRequired over rpc, protocol error). The
    // engine did not hand us bytes we can trust, so serve a minimal branded 502.
    return new Response("DIG resource unavailable", {
      status: STATUS.hardError,
      headers: headersFor("text/html; charset=utf-8"),
    });
  }

  if (result.outcome !== "success") {
    // integrity_failure / unreachable → the engine's branded text/html page, served
    // under a non-2xx status + its own text/html type + nosniff so the browser will
    // NOT execute/apply it as script or style. Fail-closed: never unverified bytes.
    const status = result.outcome === "integrity_failure" ? STATUS.integrityFailure : STATUS.unreachable;
    return new Response(body(result.bytes), { status, headers: headersFor(result.contentType) });
  }

  // Verified success — the real bytes under their real content type.
  return new Response(body(result.bytes), { status: 200, headers: headersFor(result.contentType) });
}
