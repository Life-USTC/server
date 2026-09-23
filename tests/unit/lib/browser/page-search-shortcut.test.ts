import { describe, expect, test, vi } from "vitest";
import {
  isApplePlatform,
  isGlobalSearchShortcut,
  isPageSearchShortcut,
  mountPageSearchShortcut,
  pageSearchShortcutKeys,
} from "@/lib/browser/page-search-shortcut";

function keyEvent(
  key: string,
  modifiers: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {},
) {
  return {
    key,
    ctrlKey: Boolean(modifiers.ctrl),
    metaKey: Boolean(modifiers.meta),
    shiftKey: Boolean(modifiers.shift),
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe("page-search-shortcut", () => {
  test("distinguishes global mod+k from page mod+shift+k", () => {
    expect(isGlobalSearchShortcut(keyEvent("k", { ctrl: true }))).toBe(true);
    expect(
      isGlobalSearchShortcut(keyEvent("k", { ctrl: true, shift: true })),
    ).toBe(false);
    expect(
      isPageSearchShortcut(keyEvent("k", { meta: true, shift: true })),
    ).toBe(true);
    expect(isPageSearchShortcut(keyEvent("k", { meta: true }))).toBe(false);
  });

  test("pageSearchShortcutKeys uses Apple symbols on Mac platforms", () => {
    expect(isApplePlatform("MacIntel")).toBe(true);
    expect(pageSearchShortcutKeys(true)).toEqual(["⌘", "⇧", "K"]);
    expect(pageSearchShortcutKeys(false)).toEqual(["Ctrl", "Shift", "K"]);
  });

  test("mountPageSearchShortcut focuses and selects the input", () => {
    const listeners = new Map<string, EventListener>();
    const input = {
      focus: vi.fn(),
      select: vi.fn(),
    } as unknown as HTMLInputElement;

    vi.stubGlobal("window", {
      addEventListener(type: string, listener: EventListener) {
        listeners.set(type, listener);
      },
      removeEventListener(type: string) {
        listeners.delete(type);
      },
    });

    const unmount = mountPageSearchShortcut(() => input);
    const event = keyEvent("K", { ctrl: true, shift: true });
    listeners.get("keydown")?.(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(input.focus).toHaveBeenCalledOnce();
    expect(input.select).toHaveBeenCalledOnce();
    unmount();
    expect(listeners.has("keydown")).toBe(false);
    vi.unstubAllGlobals();
  });
});
