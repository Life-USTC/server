import { CATALOG_SEARCH_MIN_LENGTH } from "@/features/catalog/lib/catalog-list-query";
import { searchLinksForGlobal } from "@/features/search/server/global-search-link-queries";
import {
  GLOBAL_SEARCH_GROUP_ORDER,
  type GlobalSearchResponse,
  type GlobalSearchResultGroupType,
  type GlobalSearchResultItem,
} from "@/features/search/server/global-search-types";
import type { AppLocale } from "@/i18n/config";
import { searchTerms } from "@/lib/query-filter-helpers";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { demoCatalogTextMatches } from "./demo-catalog-text-match";
import { getDemoHomeworks } from "./demo-homeworks";
import { getDemoSubscribedSections } from "./demo-subscriptions";
import { getDemoTodos } from "./demo-todos";

/** The existing fictional graph, with the ordinary global search's field semantics. */
export function searchDemoGlobally(input: {
  query: string;
  locale: AppLocale;
  limit?: number;
  includeWorkspace?: boolean;
}): GlobalSearchResponse {
  const query = input.query.trim();
  if (query.length < CATALOG_SEARCH_MIN_LENGTH) return { query, groups: [] };
  const limit = input.limit ?? 5;
  const terms = searchTerms(query);
  const matches = (...fields: (string | null)[]) =>
    terms.every((term) =>
      fields.some((field) => demoCatalogTextMatches(field, term)),
    );
  const sections = getDemoSubscribedSections(input.locale);
  const teachers = [
    ...new Map(
      sections
        .flatMap((section) => section.teachers)
        .map((teacher) => [teacher.id, teacher]),
    ).values(),
  ];
  const groups: Partial<
    Record<GlobalSearchResultGroupType, GlobalSearchResultItem[]>
  > = {
    sections: sections
      .filter((section) =>
        matches(
          section.code,
          section.course.code,
          section.course.nameCn,
          section.course.nameEn,
          ...section.teachers.flatMap((teacher) => [
            teacher.code,
            teacher.nameCn,
            teacher.nameEn,
          ]),
        ),
      )
      .sort(
        (a, b) =>
          (b.semester?.jwId ?? 0) - (a.semester?.jwId ?? 0) || a.jwId - b.jwId,
      )
      .map((section) => ({
        id: `section:${section.jwId}`,
        code: section.code,
        title: `${section.course.namePrimary} · ${section.teachers.map((teacher) => teacher.namePrimary).join(input.locale === "en-us" ? ", " : "、")}`,
        description: section.semester?.nameCn
          ? formatSemesterName(input.locale, section.semester.nameCn)
          : null,
        href: `/catalog/sections/${section.jwId}`,
      })),
    teachers: teachers
      .filter((teacher) =>
        matches(teacher.code, teacher.nameCn, teacher.nameEn),
      )
      .sort((a, b) =>
        a.nameCn < b.nameCn ? -1 : a.nameCn > b.nameCn ? 1 : a.id - b.id,
      )
      .map((teacher) => ({
        id: `teacher:${teacher.id}`,
        title: teacher.namePrimary,
        description: teacher.code,
        href: `/catalog/teachers/${teacher.id}`,
      })),
    courses: sections
      .map((section) => section.course)
      .filter((course) => matches(course.code, course.nameCn, course.nameEn))
      .sort((a, b) =>
        a.code < b.code ? -1 : a.code > b.code ? 1 : a.jwId - b.jwId,
      )
      .map((course) => ({
        id: `course:${course.jwId}`,
        title: course.namePrimary,
        description: course.code,
        href: `/catalog/courses/${course.jwId}`,
      })),
    links: searchLinksForGlobal(query, input.locale, limit).map((link) => ({
      id: `link:${link.slug}`,
      title: link.title,
      description: link.description,
      href: `/catalog/links#link-${encodeURIComponent(link.slug)}`,
      external: false,
    })),
  };
  if (input.includeWorkspace) {
    const dueOrder = (
      a: { due: string | null; createdAt: string },
      b: { due: string | null; createdAt: string },
    ) =>
      (a.due === null
        ? b.due === null
          ? 0
          : 1
        : b.due === null
          ? -1
          : Date.parse(a.due) - Date.parse(b.due)) ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt);
    groups.homeworks = getDemoHomeworks(input.locale)
      .filter((homework) => demoCatalogTextMatches(homework.title, query))
      .sort((a, b) =>
        dueOrder(
          { due: a.submissionDueAt, createdAt: a.createdAt },
          { due: b.submissionDueAt, createdAt: b.createdAt },
        ),
      )
      .map((homework) => ({
        id: `homework:${homework.id}`,
        title: homework.title,
        description: homework.section.course.namePrimary,
        href: `/catalog/sections/${homework.section.jwId}?homeworkId=${encodeURIComponent(homework.id)}#homework`,
      }));
    groups.todos = getDemoTodos(input.locale)
      .filter(
        (todo) =>
          demoCatalogTextMatches(todo.title, query) ||
          demoCatalogTextMatches(todo.content, query),
      )
      .sort((a, b) =>
        dueOrder(
          { due: a.dueAt, createdAt: a.createdAt },
          { due: b.dueAt, createdAt: b.createdAt },
        ),
      )
      .map((todo) => ({
        id: `todo:${todo.id}`,
        title: todo.title,
        description: todo.dueAt
          ? todo.dueAt.slice(0, 10)
          : todo.completed
            ? "completed"
            : null,
        href: "/workspace/todos",
      }));
  }
  return {
    query,
    groups: GLOBAL_SEARCH_GROUP_ORDER.flatMap((type) => {
      const items = groups[type]?.slice(0, limit) ?? [];
      return items.length ? [{ type, items }] : [];
    }),
  };
}
