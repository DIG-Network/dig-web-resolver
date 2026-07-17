import { describe, expect, it, vi } from "vitest";
import { DIG_RESPONSE_CSP, serveDigRef, type ResolveEngine } from "../src/sw/serve";

/** A fake engine returning one canned resolve outcome. */
function engineReturning(result: { outcome: string; bytes: Uint8Array; contentType: string }): ResolveEngine {
  return { resolve: vi.fn(async () => result) } as unknown as ResolveEngine;
}

/** A fake engine whose resolve rejects (hard error path). */
function engineThrowing(): ResolveEngine {
  return { resolve: vi.fn(async () => Promise.reject(new Error("RootRequired"))) } as ResolveEngine;
}

describe("serveDigRef — fail-closed HTTP responses", () => {
  it("serves verified success bytes with the real content type, nosniff, and CSP", async () => {
    const bytes = new TextEncoder().encode("console.log('dig')");
    const res = await serveDigRef(
      engineReturning({ outcome: "success", bytes, contentType: "text/javascript" }),
      "urn:dig:chia:store:root/app.js",
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/javascript");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBe(DIG_RESPONSE_CSP);
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  it("serves an integrity failure as a NON-2xx branded page — never executable success", async () => {
    const branded = new TextEncoder().encode("<html>tampered</html>");
    const res = await serveDigRef(
      engineReturning({ outcome: "integrity_failure", bytes: branded, contentType: "text/html" }),
      "urn:dig:chia:store:wrongroot/app.js",
    );

    // Non-2xx + text/html + nosniff => the browser will NOT execute/apply it as script.
    expect(res.status).toBe(409);
    expect(res.ok).toBe(false);
    expect(res.headers.get("content-type")).toBe("text/html");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("serves an unreachable outcome as a 503 branded page", async () => {
    const res = await serveDigRef(
      engineReturning({
        outcome: "unreachable",
        bytes: new TextEncoder().encode("<html>offline</html>"),
        contentType: "text/html",
      }),
      "urn:dig:chia:store:root/app.js",
    );
    expect(res.status).toBe(503);
    expect(res.ok).toBe(false);
  });

  it("maps a hard engine rejection to a branded 502 (never unverified bytes)", async () => {
    const res = await serveDigRef(engineThrowing(), "urn:dig:chia:store/rootless.js");
    expect(res.status).toBe(502);
    expect(res.ok).toBe(false);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});
