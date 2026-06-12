import { ilike } from "./admin-shared";

export function buildAdminDescriptionWhere(input: {
  hasContent: string;
  search: string;
  targetType: string;
}) {
  return {
    ...adminDescriptionTargetTypeWhere(input.targetType),
    ...adminDescriptionContentWhere(input.hasContent),
    ...adminDescriptionSearchWhere(input.search),
  };
}

export const adminDescriptionInclude = {
  lastEditedBy: {
    select: { id: true, name: true, username: true, image: true },
  },
  section: {
    select: {
      jwId: true,
      code: true,
      course: { select: { jwId: true, code: true, nameCn: true } },
    },
  },
  course: { select: { jwId: true, code: true, nameCn: true } },
  teacher: { select: { id: true, nameCn: true } },
  homework: {
    select: {
      id: true,
      title: true,
      section: {
        select: {
          jwId: true,
          code: true,
          course: { select: { jwId: true, code: true, nameCn: true } },
        },
      },
    },
  },
} as const;

function adminDescriptionTargetTypeWhere(targetType: string) {
  return targetType === "section"
    ? { sectionId: { not: null } }
    : targetType === "course"
      ? { courseId: { not: null } }
      : targetType === "teacher"
        ? { teacherId: { not: null } }
        : targetType === "homework"
          ? { homeworkId: { not: null } }
          : {};
}

function adminDescriptionContentWhere(hasContent: string) {
  return hasContent === "empty"
    ? { content: "" }
    : hasContent === "withContent"
      ? { content: { not: "" } }
      : {};
}

function adminDescriptionSearchWhere(search: string) {
  return search
    ? {
        OR: [
          { content: ilike(search) },
          { course: { code: ilike(search) } },
          { course: { nameCn: ilike(search) } },
          { section: { course: { code: ilike(search) } } },
          { section: { course: { nameCn: ilike(search) } } },
          { section: { code: ilike(search) } },
          { teacher: { nameCn: ilike(search) } },
          { homework: { title: ilike(search) } },
          { homework: { section: { course: { code: ilike(search) } } } },
          {
            homework: {
              section: { course: { nameCn: ilike(search) } },
            },
          },
        ],
      }
    : {};
}
