import {
  listCourseSummaries,
  listSectionSummaries,
  listTeacherSummaries,
} from "@/features/catalog/server/course-section-queries";
import type {
  GlobalSearchResponse,
  GlobalSearchResultGroup,
  GlobalSearchResultItem,
} from "@/features/search/server/global-search-types";
import type { AppLocale } from "@/i18n/config";
import { withUserDbContext } from "@/lib/db/prisma";
import { ilike } from "@/lib/query-filter-helpers";
import { formatSemesterName } from "@/lib/text/format-semester-name";

const DEFAULT_LIMIT = 5;
const MIN_QUERY_LENGTH = 2;

function catalogPrimaryName(item: {
  nameCn?: string | null;
  namePrimary?: string | null;
}) {
  return item.namePrimary ?? item.nameCn ?? "";
}

function toCourseItem(course: {
  code: string;
  jwId: number;
  nameCn: string | null;
  namePrimary: string | null;
}): GlobalSearchResultItem {
  return {
    id: `course:${course.jwId}`,
    title: catalogPrimaryName(course),
    description: course.code,
    href: `/catalog/courses/${course.jwId}`,
  };
}

function toSectionItem(
  section: {
    code: string;
    course: {
      code: string;
      nameCn: string | null;
      namePrimary: string | null;
    };
    jwId: number;
    semester: { nameCn: string | null } | null;
  },
  locale: AppLocale,
): GlobalSearchResultItem {
  const courseName = catalogPrimaryName(section.course);
  const semesterName = section.semester
    ? formatSemesterName(locale, section.semester.nameCn)
    : null;
  return {
    id: `section:${section.jwId}`,
    title: `${courseName} · ${section.code}`,
    description: semesterName,
    href: `/catalog/sections/${section.jwId}`,
  };
}

function toTeacherItem(teacher: {
  code: string;
  department: { nameCn: string | null } | null;
  id: number;
  nameCn: string;
}): GlobalSearchResultItem {
  return {
    id: `teacher:${teacher.id}`,
    title: teacher.nameCn,
    description: teacher.department?.nameCn ?? teacher.code,
    href: `/catalog/teachers/${teacher.id}`,
  };
}

async function searchCatalogGroups(
  query: string,
  locale: AppLocale,
  limit: number,
): Promise<GlobalSearchResultGroup[]> {
  const [courses, sections, teachers] = await Promise.all([
    listCourseSummaries({
      filters: { search: query },
      locale,
      pagination: { page: 1, pageSize: limit },
    }),
    listSectionSummaries({
      filters: { search: query },
      locale,
      pagination: { page: 1, pageSize: limit },
    }),
    listTeacherSummaries({
      filters: { search: query },
      locale,
      pagination: { page: 1, pageSize: limit },
    }),
  ]);

  const groups: GlobalSearchResultGroup[] = [];
  if (courses.data.length > 0) {
    groups.push({
      type: "courses",
      items: courses.data.map(toCourseItem),
    });
  }
  if (sections.data.length > 0) {
    groups.push({
      type: "sections",
      items: sections.data.map((section) => toSectionItem(section, locale)),
    });
  }
  if (teachers.data.length > 0) {
    groups.push({
      type: "teachers",
      items: teachers.data.map(toTeacherItem),
    });
  }
  return groups;
}

async function searchWorkspaceGroups(
  query: string,
  userId: string,
  limit: number,
): Promise<GlobalSearchResultGroup[]> {
  return withUserDbContext(userId, async (tx) => {
    const [homeworks, todos] = await Promise.all([
      tx.homework.findMany({
        where: {
          deletedAt: null,
          title: ilike(query),
          section: {
            retiredAt: null,
            subscriptions: { some: { userId } },
          },
        },
        select: {
          id: true,
          title: true,
          section: {
            select: {
              jwId: true,
              course: {
                select: {
                  namePrimary: true,
                  nameCn: true,
                },
              },
            },
          },
        },
        orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
        take: limit,
      }),
      tx.todo.findMany({
        where: {
          userId,
          OR: [{ title: ilike(query) }, { content: ilike(query) }],
        },
        select: {
          id: true,
          title: true,
          dueAt: true,
          completed: true,
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: limit,
      }),
    ]);

    const groups: GlobalSearchResultGroup[] = [];
    if (homeworks.length > 0) {
      groups.push({
        type: "homeworks",
        items: homeworks.map((homework) => ({
          id: `homework:${homework.id}`,
          title: homework.title,
          description: homework.section
            ? catalogPrimaryName(homework.section.course)
            : null,
          href: homework.section?.jwId
            ? `/catalog/sections/${homework.section.jwId}?tab=homework&homeworkId=${encodeURIComponent(homework.id)}`
            : "/workspace/homeworks",
        })),
      });
    }
    if (todos.length > 0) {
      groups.push({
        type: "todos",
        items: todos.map((todo) => ({
          id: `todo:${todo.id}`,
          title: todo.title,
          description: todo.dueAt
            ? todo.dueAt.toISOString().slice(0, 10)
            : todo.completed
              ? "completed"
              : null,
          href: "/workspace/todos",
        })),
      });
    }
    return groups;
  });
}

export async function searchGlobally(input: {
  limit?: number;
  locale: AppLocale;
  query: string;
  userId?: string | null;
}): Promise<GlobalSearchResponse> {
  const query = input.query.trim();
  const limit = input.limit ?? DEFAULT_LIMIT;
  if (query.length < MIN_QUERY_LENGTH) {
    return { query, groups: [] };
  }

  const [catalogGroups, workspaceGroups] = await Promise.all([
    searchCatalogGroups(query, input.locale, limit),
    input.userId
      ? searchWorkspaceGroups(query, input.userId, limit)
      : Promise.resolve([]),
  ]);

  return {
    query,
    groups: [...catalogGroups, ...workspaceGroups],
  };
}

export function hasGlobalSearchQuery(query: string) {
  return query.trim().length >= MIN_QUERY_LENGTH;
}
