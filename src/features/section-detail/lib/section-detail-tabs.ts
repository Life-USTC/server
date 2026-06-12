export const sectionTabIds = ["calendar", "homework", "comments"] as const;
export type SectionTab = (typeof sectionTabIds)[number];

export const homeworkViewStorageKey = "life-ustc-dashboard-homework-view-mode";

export function normalizeSectionTab(value: string | null): SectionTab | null {
  if (value === "schedule" || value === "exams") return "calendar";
  if (value === "homeworks") return "homework";
  if (value === "calendar" || value === "homework" || value === "comments") {
    return value;
  }
  return null;
}

export function sectionTabFromHash(hash: string): SectionTab | null {
  if (hash.startsWith("#tab-")) {
    return normalizeSectionTab(hash.slice("#tab-".length));
  }
  if (hash.startsWith("#comment-")) return "comments";
  if (hash.startsWith("#homework-")) return "homework";
  return null;
}
