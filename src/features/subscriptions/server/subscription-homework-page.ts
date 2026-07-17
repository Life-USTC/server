import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";
import { buildSubscribedHomeworkPageQuery } from "./subscription-homework-query";
import { buildSubscribedHomeworkInclude } from "./subscription-homework-selects";

export async function listSubscribedHomeworkPage(
  userId: string,
  {
    completed,
    dueAtFrom,
    dueAtTo,
    locale = DEFAULT_LOCALE,
    pagination,
    semesterId,
  }: {
    completed?: boolean;
    dueAtFrom?: Date;
    dueAtTo?: Date;
    locale?: AppLocale;
    pagination: {
      page: number;
      pageSize: number;
    };
    semesterId?: number;
  },
) {
  const prisma = getPrisma(locale);
  const query = buildSubscribedHomeworkPageQuery({
    completed,
    dueAtFrom,
    dueAtTo,
    semesterId,
    userId,
  });
  const page = await paginatedQuery(
    (skip, take) =>
      prisma.homework.findMany({
        ...query,
        include: buildSubscribedHomeworkInclude(userId, false),
        skip,
        take,
      }),
    () => prisma.homework.count({ where: query.where }),
    pagination.page,
    pagination.pageSize,
  );

  return {
    ...page,
    data: await withHomeworkItemState(page.data),
  };
}
