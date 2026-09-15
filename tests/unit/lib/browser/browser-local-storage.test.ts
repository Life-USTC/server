import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/browser/local-storage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser local storage", () => {
  it("returns null when reads are unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("Storage disabled", "SecurityError");
      },
    });

    expect(getLocalStorageItem("preference")).toBeNull();
  });

  it("ignores unavailable writes and removals", () => {
    vi.stubGlobal("localStorage", {
      removeItem: () => {
        throw new DOMException("Storage disabled", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("Storage disabled", "SecurityError");
      },
    });

    expect(() => setLocalStorageItem("preference", "list")).not.toThrow();
    expect(() => removeLocalStorageItem("preference")).not.toThrow();
  });
});
