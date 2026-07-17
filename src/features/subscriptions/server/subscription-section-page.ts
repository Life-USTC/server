import { sectionCatalogInclude } from "@/features/catalog/server/academic-query-includes";
import type { Prisma } from "@/generated/prisma/client";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";

const SUBSCRIBED_SECTION_ORDER_BY = [
  { semester: { jwId: "desc" } },
  { code: "asc" },
] satisfies Prisma.SectionOrderByWithRelationInput[];

export function listSubscribedSectionPage(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    pagination,
  }: {
    locale?: AppLocale;
    pagination: {
      page: number;
      pageSize: number;
    };
  },
) {
  const prisma = getPrisma(locale);
  const where = { subscribedUsers: { some: { id: userId } } };
  return paginatedQuery(
    (skip, take) =>
      prisma.section.findMany({
        where,
        include: sectionCatalogInclude,
        orderBy: SUBSCRIBED_SECTION_ORDER_BY,
        skip,
        take,
      }),
    () => prisma.section.count({ where }),
    pagination.page,
    pagination.pageSize,
  );
}
