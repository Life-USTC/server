import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import { attachHomeworkCompletionsForViewer } from "@/features/homeworks/server/homework-read-model";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma, withUserDbContext } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";
import {
  buildSubscribedHomeworkPageQuery,
  orderHomeworksById,
} from "./subscription-homework-query";
import { buildSubscribedHomeworkInclude } from "./subscription-homework-selects";

export async function listSubscribedHomeworkPage(
  userId: string,
  {
    completed,
    dueAtFrom,
    dueAtTo,
    includeEditors = false,
    locale = DEFAULT_LOCALE,
    pagination,
    semesterId,
  }: {
    completed?: boolean;
    dueAtFrom?: Date;
    dueAtTo?: Date;
    includeEditors?: boolean;
    locale?: AppLocale;
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
    semesterId,
    userId,
  });
  const { page, completions } = await withUserDbContext(userId, async (tx) => {
    const result = await paginatedQuery(
      (skip, take) =>
        tx.homework.findMany({
          ...query,
          select: { id: true },
          skip,
          take,
        }),
      () => tx.homework.count({ where: query.where }),
      pagination.page,
      pagination.pageSize,
    );
    const homeworkIds = result.data.map((homework) => homework.id);
    if (homeworkIds.length === 0) {
      return { page: result, completions: [] };
    }
    const completionRows = await tx.homeworkCompletion.findMany({
      where: {
        userId,
        homeworkId: { in: homeworkIds },
      },
      select: { homeworkId: true, completedAt: true },
    });
    return { page: result, completions: completionRows };
  });
  const homeworkIds = page.data.map((homework) => homework.id);
  if (homeworkIds.length === 0) return { ...page, data: [] };

  const homeworks = await getPrisma(locale).homework.findMany({
    where: { id: { in: homeworkIds } },
    include: buildSubscribedHomeworkInclude(includeEditors),
  });
  const orderedHomeworks = orderHomeworksById(
    attachHomeworkCompletionsForViewer(homeworks, completions),
    homeworkIds,
  );

  return {
    ...page,
    data: await withHomeworkItemState(orderedHomeworks, userId),
  };
}
