import {
  homeworkItemResponse,
  withHomeworkCompletionRequiredForViewer,
} from "@/features/homeworks/server/homework-read-model";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma, withLocalizedUserDbContext } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";
import { buildSubscribedHomeworkPageQuery } from "./subscription-homework-query";
import { buildSubscribedHomeworkInclude } from "./subscription-homework-selects";

export async function listSubscribedHomeworkPage(
  userId: string,
  {
    completed,
    dueAtFrom,
    dueAtTo,
    includeEditors = false,
    locale = DEFAULT_LOCALE,
    now = new Date(),
    pagination,
    semesterId,
  }: {
    completed?: boolean;
    dueAtFrom?: Date;
    dueAtTo?: Date;
    includeEditors?: boolean;
    locale?: AppLocale;
    now?: Date;
    pagination: {
      page: number;
      pageSize: number;
    };
    semesterId?: number;
  },
) {
  const query = buildSubscribedHomeworkPageQuery({
    completed,
    dueAtFrom,
    dueAtTo,
    now,
    semesterId,
    userId,
  });
  return withLocalizedUserDbContext(locale, userId, async () => {
    const tx = getPrisma(locale);
    const page = await paginatedQuery(
      (skip, take) =>
        tx.homework.findMany({
          ...query,
          include: {
            ...buildSubscribedHomeworkInclude(includeEditors),
            homeworkCompletions: {
              where: { userId },
              select: { completedAt: true },
            },
            _count: {
              select: { comments: { where: { status: { not: "deleted" } } } },
            },
          },
          skip,
          take,
        }),
      () => tx.homework.count({ where: query.where }),
      pagination.page,
      pagination.pageSize,
    );
    if (page.data.length === 0) return { ...page, data: [] };

    // Nested subscription reads reuse this localized RLS transaction. Comment
    // aggregates and completion rows above see the same viewer identity.
    const homeworks = await withHomeworkCompletionRequiredForViewer(
      page.data,
      userId,
    );
    return { ...page, data: homeworks.map(homeworkItemResponse) };
  });
}
