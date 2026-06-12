export type CatalogDetailTab = "comments" | "sections";

export function normalizeCatalogDetailTab(value: string | null | undefined) {
  return value === "comments" ? "comments" : "sections";
}

export function replaceCatalogDetailTabUrl(nextTab: CatalogDetailTab) {
  const url = new URL(window.location.href);
  if (nextTab === "comments") {
    url.searchParams.set("tab", "comments");
  } else {
    url.searchParams.delete("tab");
  }
  window.history.replaceState({}, "", url);
}

export function mountCatalogDetailHashNavigation(input: {
  setActiveTab: (tab: CatalogDetailTab) => void;
}) {
  const syncCommentHashTab = () => {
    if (window.location.hash.startsWith("#comment-")) {
      input.setActiveTab("comments");
    }
  };

  syncCommentHashTab();
  window.addEventListener("hashchange", syncCommentHashTab);
  return () => {
    window.removeEventListener("hashchange", syncCommentHashTab);
  };
}
