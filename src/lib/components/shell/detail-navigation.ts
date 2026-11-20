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
  url: { pathname: string },
): DetailTab {
  const segment = url.pathname.split("/")[4];
  return detailTabIds(kind).find((tab) => tab === segment) ?? "introduction";
}

export function legacyDetailDestination(
  kind: unknown,
  url:
    | URL
    | {
        pathname: string;
        hash: string;
        search: string;
        searchParams: Pick<URLSearchParams, "get">;
      },
) {
  const root = url.pathname.split("/").slice(0, 4).join("/");
  const fragment = url.hash.slice(1);
  const homework = kind === "section" && url.searchParams.get("homeworkId");
  const tab = fragment.startsWith("comment-")
    ? homework
      ? "homework"
      : "comments"
    : fragment === "teachers" && kind === "section"
      ? "overview"
      : (detailTabIds(kind).find((id) => id === fragment) ??
        (!fragment && homework && url.pathname === root
          ? "homework"
          : undefined));
  if (!tab || url.pathname === `${root}/${tab}`) return null;
  return `${root}/${tab}${url.search}${fragment.startsWith("comment-") || fragment === "teachers" ? url.hash : ""}`;
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
          href: `${current.href}/${tab}${tab === "homework" ? search : sharedSearch}`,
          label: labels[tab],
          detail: { tab, kind },
        }),
      ),
    },
    courseHref,
  };
}
