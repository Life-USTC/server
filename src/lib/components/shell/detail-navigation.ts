import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import { catalogDetailTabs } from "@/features/catalog/lib/catalog-detail-tab";
import {
  isSectionDetailTab,
  sectionDetailTabs,
  sectionTabPage,
} from "@/features/section-detail/lib/section-detail-tab";
import { currentCatalogDetailItem } from "./shell-nav-helpers";
import type { ShellLink } from "./types";

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
  let tab: DetailTab | undefined;
  if (fragment.startsWith("comment-")) {
    tab = homework
      ? "homework"
      : kind === "section"
        ? "introduction"
        : "comments";
  } else if (kind === "section" && isSectionDetailTab(fragment)) {
    tab = sectionTabPage(fragment);
  } else {
    tab = detailTabIds(kind).find((id) => id === fragment);
    if (!fragment && homework && url.pathname === root) tab = "homework";
  }
  if (!tab || url.pathname === `${root}/${tab}`) return null;
  const anchor =
    fragment.startsWith("comment-") ||
    fragment === "teachers" ||
    (fragment === "comments" && kind === "section")
      ? url.hash
      : "";
  return `${root}/${tab}${url.search}${anchor}`;
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
      ...(kind === "section"
        ? {
            href: `${current.href}/introduction${sharedSearch}`,
            detail: { kind: "section" as const, tab: "introduction" as const },
          }
        : {}),
      items: tabs
        .filter((tab) => kind !== "section" || tab !== "introduction")
        .map(
          (tab): ShellLink => ({
            href: `${current.href}/${tab}${tab === "homework" ? search : sharedSearch}`,
            label: labels[tab],
            detail: { tab, kind },
          }),
        ),
    },
  };
}
