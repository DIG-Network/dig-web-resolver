import { afterEach, describe, expect, it, vi } from "vitest";
import { __setEngineForTest, resolveContentUrl, resolveImageUrl } from "../src/engine";
import type { DigNetwork } from "@dignetwork/dig-urn-resolver";

function fakeEngine(overrides: Partial<DigNetwork> = {}): DigNetwork {
  return {
    resolveImageUrl: vi.fn(async () => "blob:image"),
    resolve: vi.fn(async () => ({
      outcome: "success",
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "text/css",
    })),
    ...overrides,
  } as unknown as DigNetwork;
}

afterEach(() => __setEngineForTest(null));

describe("engine wrapper", () => {
  it("delegates image URLs straight to the engine (fail-closed branded image lives there)", async () => {
    __setEngineForTest(fakeEngine());
    expect(await resolveImageUrl("urn:dig:chia:x/y.png")).toBe("blob:image");
  });

  it("turns verified content bytes into a blob URL under the engine's content type", async () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:content");
    __setEngineForTest(fakeEngine());
    const url = await resolveContentUrl("urn:dig:chia:x/style.css");
    expect(url).toBe("blob:content");
    const blob = create.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe("text/css");
    create.mockRestore();
  });

  it("throws if used before initialisation (no silent unverified fallback)", async () => {
    __setEngineForTest(null);
    await expect(resolveImageUrl("urn:dig:chia:x/y.png")).rejects.toThrow(/before initEngine/);
  });

  it("normalises chia:// to the engine urn grammar, preserving root-pinning", async () => {
    const engine = fakeEngine();
    __setEngineForTest(engine);
    await resolveImageUrl("chia://aa:bb/logo.png");
    expect(engine.resolveImageUrl).toHaveBeenCalledWith("urn:dig:chia:aa:bb/logo.png");
  });

  it("is fail-closed per the engine's rpc rule: a rootless URN yields the branded image, root-pinned resolves", async () => {
    // Model the engine contract (SPEC §Public-read): over the untrusted rpc tier a
    // rootless URN is RootRequired → branded error image; a root-pinned URN resolves.
    const engine = fakeEngine({
      resolveImageUrl: vi.fn(async (urn: string) => {
        const rootPinned = /^urn:dig:chia:[0-9a-f]+:[0-9a-f]+\//i.test(urn);
        return rootPinned ? "blob:verified" : "data:image/svg+xml;base64,Um9vdFJlcXVpcmVk";
      }),
    });
    __setEngineForTest(engine);
    expect(await resolveImageUrl("urn:dig:chia:aa/logo.png")).toMatch(/^data:image\//);
    expect(await resolveImageUrl("urn:dig:chia:aa:bb/logo.png")).toBe("blob:verified");
  });
});
