import { afterEach, describe, expect, it, vi } from "vitest";
import { __setEngineForTest } from "../src/engine";
import { installLinkInterceptor } from "../src/links";
import { fakeEngine } from "./helpers";

afterEach(() => {
  __setEngineForTest(null);
  document.getElementById("dig-web-resolver-overlay")?.remove();
});

function clickAnchor(href: string): MouseEvent {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", href);
  document.body.appendChild(anchor);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  anchor.dispatchEvent(event);
  return event;
}

describe("link interceptor", () => {
  it("cancels navigation and opens a DIG link in the sandbox", async () => {
    __setEngineForTest(fakeEngine());
    const remove = installLinkInterceptor(document);

    const event = clickAnchor("chia://store/page");
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(document.getElementById("dig-web-resolver-overlay")).not.toBeNull());
    remove();
  });

  it("ignores a non-DIG link (native navigation proceeds)", () => {
    __setEngineForTest(fakeEngine());
    const remove = installLinkInterceptor(document);
    const event = clickAnchor("https://example.com/page");
    expect(event.defaultPrevented).toBe(false);
    remove();
  });
});
