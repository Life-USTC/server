import { sectionDetailTabs } from "@/features/section-detail/lib/section-detail-tab";
import { catalogDetailTabs } from "./catalog-detail-tab";

/** Match only real academic entity pages and their declared child routes. */
export function academicEntityPath(pathname: string): string | null {
  const match =
    /^(\/catalog\/(courses|sections|teachers)\/([1-9]\d*))(?:\/([^/]+))?$/.exec(
      pathname,
    );
  if (!match || !Number.isSafeInteger(Number(match[3]))) return null;
  const [, entity, collection, , tab] = match;
  const tabs =
    collection === "sections" ? sectionDetailTabs : catalogDetailTabs;
  return !tab || tabs.some((id) => id === tab) ? entity : null;
}
