import {
  homeworkViewStorageKey,
  type SectionTab,
  sectionTabFromHash,
} from "./section-detail-controller-helpers";

export type SectionHomeworkView = "cards" | "list";

export function setSectionDetailTabHash(nextTab: SectionTab) {
  const nextHash = `#tab-${nextTab}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

export function persistSectionHomeworkView(nextView: SectionHomeworkView) {
  localStorage.setItem(homeworkViewStorageKey, nextView);
  const url = new URL(window.location.href);
  if (nextView === "list") {
    url.searchParams.set("homeworkView", "list");
  } else {
    url.searchParams.delete("homeworkView");
  }
  window.history.replaceState({}, "", url);
}

export function initialSectionHomeworkViewFromBrowser(
  fallback: SectionHomeworkView,
): SectionHomeworkView {
  const stored = localStorage.getItem(homeworkViewStorageKey);
  if (stored === "cards" || stored === "list") {
    return stored;
  }
  const viewParam = new URL(window.location.href).searchParams.get(
    "homeworkView",
  );
  if (viewParam === "list") {
    localStorage.setItem(homeworkViewStorageKey, "list");
    return "list";
  }
  return fallback;
}

export function mountSectionDetailNavigation(input: {
  setActiveTabFromHash: (tab: SectionTab) => void;
}) {
  const handleHash = () => {
    const nextTab = sectionTabFromHash(window.location.hash);
    if (nextTab) input.setActiveTabFromHash(nextTab);
  };

  handleHash();
  window.addEventListener("hashchange", handleHash);
  return () => window.removeEventListener("hashchange", handleHash);
}
