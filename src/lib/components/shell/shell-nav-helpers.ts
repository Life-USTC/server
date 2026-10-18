import type { ShellLink } from "./types";

type Named = {
  name?: string | null;
  nameCn?: string | null;
  namePrimary?: string | null;
};

type DetailPageData = {
  course?: Named | null;
  publication?: {
    id?: string | null;
    revision?: { title?: string | null } | null;
  } | null;
  section?: { course?: Named | null } | null;
  teacher?: Named | null;
};

export type ShellCatalogCollection =
  | "/catalog/courses"
  | "/catalog/sections"
  | "/catalog/teachers";

function displayName(entity: Named | null | undefined) {
  const label = entity?.namePrimary ?? entity?.nameCn ?? entity?.name;
  return label?.trim() ? label.trim() : null;
}

function detailEntity(
  collection: ShellCatalogCollection,
  pageData: DetailPageData,
) {
  if (collection === "/catalog/courses") return pageData.course;
  if (collection === "/catalog/sections") return pageData.section?.course;
  return pageData.teacher;
}

/**
 * Every catalog detail page lists the open record once under its collection,
 * using the record's display name.
 */
export function currentCatalogDetailItem(
  collection: ShellCatalogCollection,
  pathname: string,
  pageData: DetailPageData,
): ShellLink | null {
  const match = pathname.match(
    /^\/catalog\/(courses|sections|teachers)\/([^/]+)/,
  );
  if (!match || `/catalog/${match[1]}` !== collection) return null;
  const label = displayName(detailEntity(collection, pageData));
  if (!label) return null;
  return { href: `${collection}/${match[2]}`, label };
}

export function currentNewsItem(
  pathname: string,
  pageData: DetailPageData,
): ShellLink | null {
  const match = pathname.match(/^\/news\/([^/]+)/);
  if (!match || match[1] === "sources") return null;
  const id = pageData.publication?.id;
  const title = pageData.publication?.revision?.title?.trim();
  if (!id || !title) return null;
  return { href: `/news/${encodeURIComponent(id)}`, label: title };
}
