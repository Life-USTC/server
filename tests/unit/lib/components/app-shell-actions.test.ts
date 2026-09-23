import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadStoredThemeMode,
  setStoredThemeMode,
} from "@/lib/components/shell/app-shell-actions";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("application shell theme storage", () => {
  it("uses the fallback when stored theme access is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("Storage disabled", "SecurityError");
      },
    });

    expect(loadStoredThemeMode("system")).toBe("system");
  });

  it("applies the selected theme when persistence is unavailable", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new DOMException("Storage disabled", "SecurityError");
      },
    });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    const dataset: Record<string, string> = {};
    vi.stubGlobal("document", {
      documentElement: { dataset },
    });

    expect(setStoredThemeMode("dark")).toBe("dark");
    expect(dataset.theme).toBe("dark");
  });
});
