import type { ShellLink } from "./types";

type DetailPageData = {
  course?: { namePrimary?: string | null; nameCn?: string | null } | null;
  section?: {
    course?: { namePrimary?: string | null; nameCn?: string | null } | null;
  } | null;
  teacher?: { namePrimary?: string | null; nameCn?: string | null } | null;
};

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
