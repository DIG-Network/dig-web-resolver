import { describe, expect, it } from "vitest";
import { tryClaim } from "../src/sentinel";

describe("coexistence sentinel", () => {
  it("claims an unclaimed page and freezes the record", () => {
    const won = tryClaim("1.2.3", "page", 1000);
    expect(won).toBe(true);
    const claim = window.__digWebResolver as Record<string, unknown>;
    expect(claim).toEqual({ claimed: true, version: "1.2.3", source: "page", claimedAt: 1000 });
    expect(Object.isFrozen(claim)).toBe(true);
  });

  it("defers on a second load — first-to-claim wins, version-agnostic", () => {
    expect(tryClaim("1.0.0", "extension", 1)).toBe(true);
    // A newer/older second instance must NOT take over.
    expect(tryClaim("9.9.9", "page", 2)).toBe(false);
    const claim = window.__digWebResolver as Record<string, unknown>;
    expect(claim.version).toBe("1.0.0");
    expect(claim.source).toBe("extension");
  });

  it("resists a hostile page tampering with a frozen claim", () => {
    tryClaim("1.0.0", "page");
    const claim = window.__digWebResolver as { claimed: boolean };
    // A frozen object silently ignores writes (non-strict) — claimed stays true.
    try {
      claim.claimed = false;
    } catch {
      /* strict-mode throw is also acceptable */
    }
    expect(claim.claimed).toBe(true);
    expect(tryClaim("2.0.0", "page")).toBe(false);
  });

  it("treats a pre-set claimed flag as an existing owner (defers)", () => {
    window.__digWebResolver = { claimed: true };
    expect(tryClaim("1.0.0", "page")).toBe(false);
  });
});
