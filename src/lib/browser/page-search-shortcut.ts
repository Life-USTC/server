/** Page-local search focus: ⌘⇧K / Ctrl+Shift+K (distinct from global ⌘K / Ctrl+K). */

export function isApplePlatform(
  userAgentPlatform = typeof navigator === "undefined"
    ? ""
    : navigator.platform,
) {
  return /Mac|iPhone|iPad|iPod/.test(userAgentPlatform);
}

export function isGlobalSearchShortcut(event: KeyboardEvent) {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    event.key.toLowerCase() === "k"
  );
}

export function isPageSearchShortcut(event: KeyboardEvent) {
  return (
    (event.metaKey || event.ctrlKey) &&
    event.shiftKey &&
    event.key.toLowerCase() === "k"
  );
}

/** Keycap labels for the page-search shortcut hint. */
export function pageSearchShortcutKeys(apple = isApplePlatform()) {
  return apple ? (["⌘", "⇧", "K"] as const) : (["Ctrl", "Shift", "K"] as const);
}

export function mountPageSearchShortcut(
  getInput: () => HTMLInputElement | null | undefined,
) {
  function handleShortcut(event: KeyboardEvent) {
    if (!isPageSearchShortcut(event)) return;
    const input = getInput();
    if (!input) return;
    event.preventDefault();
    input.focus();
    input.select();
  }

  window.addEventListener("keydown", handleShortcut);
  return () => window.removeEventListener("keydown", handleShortcut);
}
