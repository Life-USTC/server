import {
  getLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/browser/local-storage";

export type SectionHomeworkView = "cards" | "list";

const homeworkViewStorageKey = "life-ustc-workspace-homework-view-mode";

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
