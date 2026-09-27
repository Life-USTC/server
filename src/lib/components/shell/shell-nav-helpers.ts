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
  section?: {
    course?: Named | null;
    jwId?: number | string | null;
  } | null;
  teacher?: Named | null;
};

export type ShellSectionDirectoryItem = {
  href: string;
  label: string;
};

function displayName(entity: Named | null | undefined, fallback: string) {
  const label = entity?.namePrimary ?? entity?.nameCn ?? entity?.name;
  return label?.trim() ? label : fallback;
}

function withCurrentItem(items: ShellLink[], current: ShellLink | null) {
  if (!current) return items;
  if (items.some((item) => item.href === current.href)) return items;
  return [...items, current];
}

export function buildDetailSecondaryLinks(
  pathname: string,
  pageData: DetailPageData,
): ShellLink[] {
  const courseMatch = pathname.match(/^\/catalog\/courses\/([^/]+)/);
  if (courseMatch && pageData.course) {
    return [
      {
        href: pathname,
        label:
          pageData.course.namePrimary ?? pageData.course.nameCn ?? pathname,
      },
    ];
  }

  const sectionMatch = pathname.match(/^\/catalog\/sections\/([^/]+)/);
  if (sectionMatch && pageData.section?.course) {
    return [
      {
        href: pathname,
        label:
          pageData.section.course.namePrimary ??
          pageData.section.course.nameCn ??
          pathname,
      },
    ];
  }

  const teacherMatch = pathname.match(/^\/catalog\/teachers\/([^/]+)/);
  if (teacherMatch && pageData.teacher) {
    return [
      {
        href: pathname,
        label:
          pageData.teacher.namePrimary ?? pageData.teacher.nameCn ?? pathname,
      },
    ];
  }

  return [];
}

export function sectionDirectoryItems(
  pathname: string,
  pageData: DetailPageData,
  subscribed: readonly ShellSectionDirectoryItem[],
): ShellLink[] {
  const items = subscribed.map((item) => ({
    href: item.href,
    label: item.label,
  }));
  const match = pathname.match(/^\/catalog\/sections\/([^/]+)/);
  if (!match) return items;
  const href = `/catalog/sections/${match[1]}`;
  return withCurrentItem(items, {
    href,
    label: displayName(pageData.section?.course, match[1]),
  });
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
