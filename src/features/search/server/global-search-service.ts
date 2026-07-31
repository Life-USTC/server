import {
  searchCoursesForGlobal,
  searchSectionsForGlobal,
  searchTeachersForGlobal,
} from "@/features/search/server/global-search-catalog-queries";
import { searchLinksForGlobal } from "@/features/search/server/global-search-link-queries";
import type {
  GlobalSearchResponse,
  GlobalSearchResultGroup,
  GlobalSearchResultGroupType,
  GlobalSearchResultItem,
} from "@/features/search/server/global-search-types";
import { GLOBAL_SEARCH_GROUP_ORDER } from "@/features/search/server/global-search-types";
import type { AppLocale } from "@/i18n/config";
import { cachedCatalogRuntimeData } from "@/lib/catalog-runtime-cache";
import { withUserDbContext } from "@/lib/db/prisma";
import type { PublicRuntimeCacheAnalyticsNamespace } from "@/lib/metrics/analytics-engine";
import { ilike } from "@/lib/query-filter-helpers";
import { formatSemesterName } from "@/lib/text/format-semester-name";

const DEFAULT_LIMIT = 5;
const MIN_QUERY_LENGTH = 2;
/** Catalog search is shared across users; short L1 TTL keeps results fresh enough. */
const SEARCH_CATALOG_CACHE_TTL_MS = 300_000;

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
  const semesterName = section.semester?.nameCn
    ? formatSemesterName(locale, section.semester.nameCn)
    : null;
  return {
    id: `section:${section.jwId}`,
    title: `${courseName} · ${section.code}`,
    description: semesterName,
    href: `/catalog/sections/${section.jwId}`,
  };
}

async function searchCatalogGroups(
  query: string,
  locale: AppLocale,
  limit: number,
): Promise<GlobalSearchResultGroup[]> {
  const [courses, teachers, sections, links] = await Promise.all([
    searchCoursesForGlobal(query, locale, limit),
    searchTeachersForGlobal(query, locale, limit),
    searchSectionsForGlobal(query, locale, limit),
    Promise.resolve(searchLinksForGlobal(query, locale, limit)),
  ]);

  const groupItems: Record<
    GlobalSearchResultGroupType,
    GlobalSearchResultItem[]
  > = {
    courses: courses.map(toCourseItem),
    teachers: teachers.map((teacher) => ({
      id: `teacher:${teacher.id}`,
      title: teacher.nameCn,
      description: teacher.department?.nameCn ?? teacher.code,
      href: `/catalog/teachers/${teacher.id}`,
    })),
    sections: sections.map((section) => toSectionItem(section, locale)),
    links: links.map((link) => ({
      id: `link:${link.slug}`,
      title: link.title,
      description: link.description,
      href: link.url,
      external: true,
    })),
    homeworks: [],
    todos: [],
  };

  return GLOBAL_SEARCH_GROUP_ORDER.flatMap((type) => {
    const items = groupItems[type];
    return items.length > 0 ? [{ type, items }] : [];
  });
}

function catalogSearchCacheKey(query: string, limit: number) {
  return `${limit}:${query}`;
}

async function searchCachedCatalogGroups(input: {
  limit: number;
  locale: AppLocale;
  origin: string;
  query: string;
}): Promise<GlobalSearchResultGroup[]> {
  const namespace: PublicRuntimeCacheAnalyticsNamespace = `search:catalog:v2:${input.locale}`;
  return cachedCatalogRuntimeData(
    namespace,
    catalogSearchCacheKey(input.query, input.limit),
    input.origin,
    () => searchCatalogGroups(input.query, input.locale, input.limit),
    { ttlMs: SEARCH_CATALOG_CACHE_TTL_MS },
  );
}

function workspaceCourseName(
  course: { nameCn: string | null; nameEn: string | null },
  locale: AppLocale,
) {
  if (locale === "en-us") {
    return course.nameEn ?? course.nameCn ?? "";
  }
  return course.nameCn ?? course.nameEn ?? "";
}

async function searchWorkspaceGroups(
  query: string,
  userId: string,
  locale: AppLocale,
  limit: number,
): Promise<GlobalSearchResultGroup[]> {
  return withUserDbContext(userId, async (tx) => {
    const homeworks = await tx.homework.findMany({
      where: {
        deletedAt: null,
        title: ilike(query),
        section: {
          sectionSubscriptions: { some: { userId } },
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
                nameCn: true,
                nameEn: true,
              },
            },
          },
        },
      },
      orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
      take: limit,
    });
    const todos = await tx.todo.findMany({
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
    });

    const groups: GlobalSearchResultGroup[] = [];
    if (homeworks.length > 0) {
      groups.push({
        type: "homeworks",
        items: homeworks.map((homework) => ({
          id: `homework:${homework.id}`,
          title: homework.title,
          description: homework.section
            ? workspaceCourseName(homework.section.course, locale)
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
  origin: string;
  query: string;
  userId?: string | null;
}): Promise<GlobalSearchResponse> {
  const query = input.query.trim();
  const limit = input.limit ?? DEFAULT_LIMIT;
  if (query.length < MIN_QUERY_LENGTH) {
    return { query, groups: [] };
  }

  const catalogGroups = await searchCachedCatalogGroups({
    limit,
    locale: input.locale,
    origin: input.origin,
    query,
  });

  let workspaceGroups: GlobalSearchResultGroup[] = [];
  if (input.userId) {
    try {
      workspaceGroups = await searchWorkspaceGroups(
        query,
        input.userId,
        input.locale,
        limit,
      );
    } catch (error) {
      console.error("Global search workspace query failed", error);
    }
  }

  return {
    query,
    groups: [...catalogGroups, ...workspaceGroups],
  };
}

export function hasGlobalSearchQuery(query: string) {
  return query.trim().length >= MIN_QUERY_LENGTH;
}
