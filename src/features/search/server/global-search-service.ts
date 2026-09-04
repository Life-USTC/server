import { CATALOG_SEARCH_MIN_LENGTH } from "@/features/catalog/lib/catalog-list-query";
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
import { runCloudflareTraceSpan } from "@/lib/ports/runtime";
import { cachedCatalogRuntimeData } from "@/lib/catalog-runtime-cache";
import { withUserDbContext } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import type { PublicRuntimeCacheAnalyticsNamespace } from "@/lib/metrics/analytics-engine";
import { ilike } from "@/lib/query-filter-helpers";
import { formatSemesterName } from "@/lib/text/format-semester-name";

const DEFAULT_LIMIT = 5;
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
    campus: {
      nameCn: string | null;
      namePrimary: string | null;
    } | null;
    code: string;
    course: {
      code: string;
      nameCn: string | null;
      namePrimary: string | null;
    };
    jwId: number;
    semester: { nameCn: string | null } | null;
    teachers: Array<{
      nameCn: string | null;
      namePrimary: string | null;
    }>;
  },
  locale: AppLocale,
): GlobalSearchResultItem {
  const courseName = catalogPrimaryName(section.course);
  const teacherNames = section.teachers
    .map((teacher) => catalogPrimaryName(teacher))
    .filter(Boolean);
  const teacherSeparator = locale === "en-us" ? ", " : "、";
  const title =
    teacherNames.length > 0
      ? `${courseName} · ${teacherNames.join(teacherSeparator)}`
      : `${courseName} · ${section.code}`;
  const semesterName = section.semester?.nameCn
    ? formatSemesterName(locale, section.semester.nameCn)
    : null;
  const campusName = section.campus ? catalogPrimaryName(section.campus) : null;
  const description = [semesterName, campusName || null, section.code]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  return {
    id: `section:${section.jwId}`,
    title,
    description: description || null,
    href: `/catalog/sections/${section.jwId}`,
  };
}

async function searchCatalogGroups(
  query: string,
  locale: AppLocale,
  limit: number,
): Promise<GlobalSearchResultGroup[]> {
  const [courses, teachers, sections] = await Promise.all([
    searchCoursesForGlobal(query, locale, limit),
    searchTeachersForGlobal(query, locale, limit),
    searchSectionsForGlobal(query, locale, limit),
  ]);

  const groupItems: Partial<
    Record<GlobalSearchResultGroupType, GlobalSearchResultItem[]>
  > = {
    courses: courses.map(toCourseItem),
    teachers: teachers.map((teacher) => ({
      id: `teacher:${teacher.id}`,
      title: teacher.nameCn,
      description: teacher.department?.nameCn ?? teacher.code,
      href: `/catalog/teachers/${teacher.id}`,
    })),
    sections: sections.map((section) => toSectionItem(section, locale)),
  };

  return GLOBAL_SEARCH_GROUP_ORDER.flatMap((type) => {
    const items = groupItems[type] ?? [];
    return items.length > 0 ? [{ type, items }] : [];
  });
}

function searchLinkGroups(
  query: string,
  locale: AppLocale,
  limit: number,
): GlobalSearchResultGroup[] {
  const items = searchLinksForGlobal(query, locale, limit).map((link) => ({
    id: `link:${link.slug}`,
    title: link.title,
    description: link.description,
    href: link.url,
    external: true,
  }));
  return items.length > 0 ? [{ type: "links", items }] : [];
}

function orderSearchGroups(
  groups: GlobalSearchResultGroup[],
): GlobalSearchResultGroup[] {
  const itemsByType = new Map<
    GlobalSearchResultGroupType,
    GlobalSearchResultItem[]
  >();
  for (const group of groups) {
    const items = itemsByType.get(group.type) ?? [];
    items.push(...group.items);
    itemsByType.set(group.type, items);
  }

  return GLOBAL_SEARCH_GROUP_ORDER.flatMap((type) => {
    const items = itemsByType.get(type) ?? [];
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
  const namespace: PublicRuntimeCacheAnalyticsNamespace = `search:catalog:v4:${input.locale}`;
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
    const homeworks = await runCloudflareTraceSpan(
      "search.workspace.homeworks",
      { "search.scope": "workspace" },
      () =>
        tx.homework.findMany({
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
        }),
    );
    const todos = await runCloudflareTraceSpan(
      "search.workspace.todos",
      { "search.scope": "workspace" },
      () =>
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
    );

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
            ? `/catalog/sections/${homework.section.jwId}?homeworkId=${encodeURIComponent(homework.id)}#homework`
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
  const userId = input.userId;
  if (query.length < CATALOG_SEARCH_MIN_LENGTH) {
    return { query, groups: [] };
  }

  const catalogGroupsPromise = runCloudflareTraceSpan(
    "search.catalog",
    { "search.scope": "catalog" },
    () =>
      searchCachedCatalogGroups({
        limit,
        locale: input.locale,
        origin: input.origin,
        query,
      }),
  );
  const workspaceGroupsPromise = userId
    ? runCloudflareTraceSpan(
        "search.workspace",
        { "search.scope": "workspace" },
        () => searchWorkspaceGroups(query, userId, input.locale, limit),
      ).catch((error): GlobalSearchResultGroup[] => {
        // Workspace results are optional; catalog results still stand on their own.
        logAppEvent(
          "warn",
          "Global search workspace query failed",
          { source: "global-search" },
          error,
        );
        return [];
      })
    : Promise.resolve([]);
  const [catalogGroups, workspaceGroups] = await Promise.all([
    catalogGroupsPromise,
    workspaceGroupsPromise,
  ]);
  const linkGroups = searchLinkGroups(query, input.locale, limit);

  return {
    query,
    groups: orderSearchGroups([
      ...catalogGroups,
      ...linkGroups,
      ...workspaceGroups,
    ]),
  };
}

export function hasGlobalSearchQuery(query: string) {
  return query.trim().length >= CATALOG_SEARCH_MIN_LENGTH;
}
