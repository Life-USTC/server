import {
  type SectionIdentity,
  sectionSummaryParts,
} from "@/features/catalog/lib/catalog-list-display";
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
  locale?: string;
  section?: SectionIdentity | null;
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
  const href = `${collection}/${match[2]}`;
  if (collection === "/catalog/sections") {
    if (!pageData.section) return null;
    const lines = sectionSummaryParts(pageData.section, pageData.locale);
    const label = lines.join("");
    if (!label) return null;
    const [course, context] = lines;
    if (!context) return { href, label };
    return {
      href,
      label,
      labelLines: [
        course,
        context.replace(/^(（\d{4})年(?=[春秋]季学期)/, "$1"),
      ],
    };
  }
  const label = displayName(
    collection === "/catalog/courses" ? pageData.course : pageData.teacher,
  );
  return label ? { href, label } : null;
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
