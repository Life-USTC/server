const primarySidebarCollapsedKey = "life-ustc-primary-sidebar-collapsed";
const secondarySidebarCollapsedKey = "life-ustc-secondary-sidebar-collapsed";

function loadStoredCollapsed(key: string, fallback = false) {
  return localStorage.getItem(key) === "true"
    ? true
    : localStorage.getItem(key) === "false"
      ? false
      : fallback;
}

function setStoredCollapsed(key: string, collapsed: boolean) {
  localStorage.setItem(key, String(collapsed));
  return collapsed;
}

export function loadPrimarySidebarCollapsed(fallback = false) {
  return loadStoredCollapsed(primarySidebarCollapsedKey, fallback);
}

export function setPrimarySidebarCollapsed(collapsed: boolean) {
  return setStoredCollapsed(primarySidebarCollapsedKey, collapsed);
}

export function loadSecondarySidebarCollapsed(fallback = false) {
  return loadStoredCollapsed(secondarySidebarCollapsedKey, fallback);
}

export function setSecondarySidebarCollapsed(collapsed: boolean) {
  return setStoredCollapsed(secondarySidebarCollapsedKey, collapsed);
}
