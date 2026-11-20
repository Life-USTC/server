import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import { catalogDetailTabs } from "@/features/catalog/lib/catalog-detail-tab";
import { sectionDetailTabs } from "@/features/section-detail/lib/section-detail-tab";
import { currentCatalogDetailItem } from "./shell-nav-helpers";
import type { ShellLink } from "./types";

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function detailTabIds(kind: unknown) {
  return kind === "section"
    ? sectionDetailTabs
    : kind === "course" || kind === "teacher"
      ? catalogDetailTabs
      : ([] as const);
}

export type DetailTab =
  | (typeof sectionDetailTabs)[number]
  | (typeof catalogDetailTabs)[number];

export function activeDetailTab(
  kind: unknown,
  url: { hash: string; searchParams: Pick<URLSearchParams, "get"> },
): DetailTab {
  if (url.hash.startsWith("#comment-"))
    return kind === "section" && url.searchParams.get("homeworkId")
      ? "homework"
      : "comments";
  if (kind === "section" && url.hash === "#teachers") return "overview";
  const tab = detailTabIds(kind).find((id) => url.hash === `#${id}`);
  if (tab) return tab;
  if (kind === "section" && url.searchParams.get("homeworkId"))
    return "homework";
  return "introduction";
}

/** Public entity facts and route-declared content capabilities only. */
export function detailNavigation(
  pageData: Record<string, unknown>,
  pathname: string,
  copy: LayoutCopy,
  search = "",
) {
  const kind = pageData.shellDetail;
  if (kind !== "course" && kind !== "section" && kind !== "teacher")
    return null;
  const collection =
    kind === "course"
      ? "/catalog/courses"
      : kind === "section"
        ? "/catalog/sections"
        : "/catalog/teachers";
  const current = currentCatalogDetailItem(collection, pathname, pageData);
  if (!current) return null;
  const labels = copy.shell.detailNavigation;
  const tabs = detailTabIds(kind);
  let sharedSearch = search;
  if (kind === "section") {
    const params = new URLSearchParams(search);
    if (params.has("homeworkId")) {
      params.delete("homeworkId");
      sharedSearch = params.size ? `?${params}` : "";
    }
  }
  const course = record(record(pageData.section)?.course);
  const jwId = course?.jwId;
  const courseHref =
    kind === "section" &&
    ((typeof jwId === "number" && Number.isSafeInteger(jwId) && jwId > 0) ||
      (typeof jwId === "string" && /^[1-9]\d*$/.test(jwId)))
      ? `/catalog/courses/${jwId}`
      : null;
  return {
    collection: {
      href: collection,
      label:
        kind === "course"
          ? copy.nav.courses
          : kind === "section"
            ? copy.nav.sections
            : copy.nav.teachers,
    },
    current: {
      ...current,
      items: tabs.map(
        (tab): ShellLink => ({
          href: `${current.href}${tab === "homework" ? search : sharedSearch}#${tab}`,
          label: labels[tab],
          detail: { tab, kind },
        }),
      ),
    },
    courseHref,
  };
}
