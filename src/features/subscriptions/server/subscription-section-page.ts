import { sectionCatalogInclude } from "@/features/catalog/server/academic-query-includes";
import type { Prisma } from "@/generated/prisma/client";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma, withUserDbContext } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";
import { getSubscribedSectionIds } from "./subscription-read-model-shared";

const SUBSCRIBED_SECTION_ORDER_BY = [
  { semester: { jwId: "desc" } },
  { code: "asc" },
] satisfies Prisma.SectionOrderByWithRelationInput[];

export async function listSubscribedSectionPage(
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
  const sectionIds = await getSubscribedSectionIds(userId);
  const prisma = getPrisma(locale);
  const where = { id: { in: sectionIds } };
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

export async function listSubscribedMembershipPage(
  userId: string,
  options: Parameters<typeof listSubscribedSectionPage>[1],
) {
  return withUserDbContext(userId, (tx) =>
    paginatedQuery(
      (skip, take) =>
        tx.userSectionSubscription.findMany({
          where: { userId },
          select: { kind: true, section: { include: sectionCatalogInclude } },
          orderBy: SUBSCRIBED_SECTION_ORDER_BY.map((section) => ({ section })),
          skip,
          take,
        }),
      () => tx.userSectionSubscription.count({ where: { userId } }),
      options.pagination.page,
      options.pagination.pageSize,
    ),
  );
}
