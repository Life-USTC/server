import {
  getLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/browser/local-storage";

export type SectionHomeworkView = "cards" | "list";

const homeworkViewStorageKey = "life-ustc-dashboard-homework-view-mode";

export function persistSectionHomeworkView(nextView: SectionHomeworkView) {
  setLocalStorageItem(homeworkViewStorageKey, nextView);
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
  const stored = getLocalStorageItem(homeworkViewStorageKey);
  if (stored === "cards" || stored === "list") {
    return stored;
  }
  const viewParam = new URL(window.location.href).searchParams.get(
    "homeworkView",
  );
  if (viewParam === "list") {
    setLocalStorageItem(homeworkViewStorageKey, "list");
    return "list";
  }
  return fallback;
}
