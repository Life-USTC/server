import {
  homeworkItemResponse,
  withHomeworkCompletionRequiredForViewer,
} from "@/features/homeworks/server/homework-read-model";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma, withUserDbContext } from "@/lib/db/prisma";
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
  const page = await withUserDbContext(userId, async (tx) => {
    const page = await paginatedQuery(
      (skip, take) =>
        tx.homework.findMany({
          ...query,
          include: {
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

    // Nested subscription reads reuse this RLS transaction. Comment
    // aggregates and completion rows above see the same viewer identity.
    const homeworks = await withHomeworkCompletionRequiredForViewer(
      page.data,
      userId,
    );
    return { ...page, data: homeworks.map(homeworkItemResponse) };
  });
  if (page.data.length === 0) return { ...page, data: [] };

  // Only viewer-dependent state belongs in the RLS transaction. Public
  // display relations can require many SQL round trips and must not consume
  // its execution budget. Keep the scalar page and its ordering from above.
  const relations = await getPrisma(locale).homework.findMany({
    where: { id: { in: page.data.map((homework) => homework.id) } },
    select: { id: true, ...buildSubscribedHomeworkInclude(includeEditors) },
  });
  const relationsById = new Map(relations.map((row) => [row.id, row]));
  return {
    ...page,
    data: page.data.flatMap((homework) => {
      const display = relationsById.get(homework.id);
      return display ? [{ ...display, ...homework }] : [];
    }),
  };
}
