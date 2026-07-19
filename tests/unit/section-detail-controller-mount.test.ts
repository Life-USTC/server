import { afterEach, describe, expect, it, vi } from "vitest";
import { mountSectionDetailController } from "@/features/section-detail/lib/section-detail-controller-mount";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mountSectionDetailController", () => {
  it.each([
    { expectedCalls: 1, shouldLoadHomeworks: true },
    { expectedCalls: 0, shouldLoadHomeworks: false },
  ])("loads homework $expectedCalls time(s) when shouldLoadHomeworks is $shouldLoadHomeworks", ({
    expectedCalls,
    shouldLoadHomeworks,
  }) => {
    vi.stubGlobal("window", {
      location: {
        href: "https://example.test/sections/301",
        origin: "https://example.test",
      },
    });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(null),
    });
    const clearClipboardTimer = vi.fn();
    const loadHomeworks = vi.fn();

    const cleanup = mountSectionDetailController({
      clearClipboardTimer,
      getHomeworkView: () => "cards",
      loadHomeworks,
      setHomeworkView: vi.fn(),
      setOrigin: vi.fn(),
      shouldLoadHomeworks,
    });

    expect(loadHomeworks).toHaveBeenCalledTimes(expectedCalls);
    cleanup();
    expect(clearClipboardTimer).toHaveBeenCalledOnce();
  });
});
