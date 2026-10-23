import { paginatedSectionHistoryResponseSchema } from "@/features/catalog/lib/section-history-response-schemas";
import type { AppLocale } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { sectionSummarySelect } from "./academic-query-includes";
import { toSectionSummaryDto } from "./academic-summary-dto-mappers";
import { cachedCatalogListRead } from "./catalog-list-cache";
import { SECTION_SUMMARY_DEFAULT_ORDER_BY } from "./section-summary-read-model";

export type SectionHistoryScope =
  | { kind: "course"; jwId: number }
  | { kind: "teacher"; id: number };

export async function listSectionHistory(input: {
  scope: SectionHistoryScope;
  locale: AppLocale;
  pagination: { page: number; pageSize: number };
}) {
  const { scope, locale, pagination } = input;
  return cachedCatalogListRead({
    filters: scope,
    kind: "sections",
    locale,
    pagination,
    shape: "scoped-history-v1",
    load: async () => {
      const prisma = getPrisma(locale);
      const parent =
        scope.kind === "course"
          ? await prisma.course.findUnique({
              where: { jwId: scope.jwId },
              select: { id: true },
            })
          : await prisma.teacher.findUnique({
              where: { id: scope.id },
              select: { id: true },
            });
      if (!parent) return null;
      const where =
        scope.kind === "course"
          ? { courseId: parent.id }
          : { teachers: { some: { id: parent.id } } };
      const result = await paginatedQuery(
        (skip, take) =>
          prisma.section.findMany({
            where,
            skip,
            take,
            select: { ...sectionSummarySelect, retiredAt: true },
            orderBy: SECTION_SUMMARY_DEFAULT_ORDER_BY,
          }),
        () => prisma.section.count({ where }),
        pagination.page,
        pagination.pageSize,
      );
      return paginatedSectionHistoryResponseSchema.parse({
        ...result,
        data: result.data.map((section) => ({
          ...toSectionSummaryDto(section, locale),
          retiredAt: section.retiredAt
            ? toShanghaiIsoString(section.retiredAt)
            : null,
        })),
      });
    },
  });
}
