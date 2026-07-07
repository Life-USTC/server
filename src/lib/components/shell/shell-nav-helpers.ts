import type { ShellLink } from "./types";

type DetailPageData = {
  course?: { namePrimary?: string | null; nameCn?: string | null } | null;
  section?: {
    course?: { namePrimary?: string | null; nameCn?: string | null } | null;
  } | null;
  teacher?: { namePrimary?: string | null; nameCn?: string | null } | null;
  subscriptions?: {
    subscriptions?: Array<{
      sections?: Array<{
        id: number | string;
        jwId: number | null;
        course?: { namePrimary?: string | null; nameCn?: string | null } | null;
      }>;
    }>;
  } | null;
};

export function buildDetailSecondaryLinks(
  pathname: string,
  pageData: DetailPageData,
): ShellLink[] {
  const courseMatch = pathname.match(/^\/courses\/([^/]+)/);
  if (courseMatch && pageData.course) {
    return [
      {
        href: pathname,
        label:
          pageData.course.namePrimary ?? pageData.course.nameCn ?? pathname,
      },
    ];
  }

  const sectionMatch = pathname.match(/^\/sections\/([^/]+)/);
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

  const teacherMatch = pathname.match(/^\/teachers\/([^/]+)/);
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

export function buildSubscriptionSecondaryLinks(
  pageData: DetailPageData,
): ShellLink[] {
  const groups = pageData.subscriptions?.subscriptions ?? [];
  const links: ShellLink[] = [];
  for (const group of groups) {
    for (const section of group.sections ?? []) {
      if (section.jwId == null) continue;
      links.push({
        href: `/sections/${section.jwId}`,
        label:
          section.course?.namePrimary ?? section.course?.nameCn ?? "Section",
      });
    }
  }
  return links;
}
