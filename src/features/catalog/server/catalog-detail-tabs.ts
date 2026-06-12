const TABS = new Set(["sections", "comments"]);

export function normalizeCatalogTab(tab: string | null) {
  return tab && TABS.has(tab) ? tab : "sections";
}
