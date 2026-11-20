import { isCatalogDetailTab } from "@/features/catalog/lib/catalog-detail-tab";
import { isSectionDetailTab } from "@/features/section-detail/lib/section-detail-tab";
export type PageSsrClass = "dynamic-ssr" | "public-ssr";

export type PageAuthSignalPresence = "absent" | "present";

export type PageCatalogDetailTab =
  | "calendar"
  | "comments"
  | "exams"
  | "homework"
  | "introduction"
  | "not_applicable"
  | "overview"
  | "sections"
  | "teachers";

export function classifyPageSsrClass(publicSsr: boolean): PageSsrClass {
  return publicSsr ? "public-ssr" : "dynamic-ssr";
}

export function classifyPageAuthSignalPresence(
  hasAuthSignal: boolean,
): PageAuthSignalPresence {
  return hasAuthSignal ? "present" : "absent";
}

export function resolvePageCatalogDetailTab(
  routeId: string | null,
): PageCatalogDetailTab {
  const match = routeId?.match(
    /^\/catalog\/(sections|courses|teachers)\/\[(?:jwId|id)\](?:\/(\w+))?$/,
  );
  if (!match) return "not_applicable";
  const tab = match[2] ?? "introduction";
  if (match[1] === "sections")
    return isSectionDetailTab(tab) ? tab : "not_applicable";
  return isCatalogDetailTab(tab) ? tab : "not_applicable";
}
