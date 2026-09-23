import { withCommentDbContext } from "@/features/comments/server/comment-db-context";

type HomeworkCompletionRecord = {
  completedAt: Date;
};

type HomeworkWithOptionalCompletions = {
  id: string;
  homeworkCompletions?: HomeworkCompletionRecord[];
};

export type HomeworkItemWithState<T extends HomeworkWithOptionalCompletions> =
  Omit<T, "homeworkCompletions"> & {
    completion: HomeworkCompletionRecord | null;
    commentCount: number;
  };

export async function withHomeworkItemState<
  T extends HomeworkWithOptionalCompletions,
>(
  homeworks: T[],
  viewerUserId: string | null = null,
): Promise<Array<HomeworkItemWithState<T>>> {
  if (homeworks.length === 0) {
    return [];
  }

  const commentCountRows = await withCommentDbContext(viewerUserId, (client) =>
    client.comment.groupBy({
      by: ["homeworkId"],
      where: {
        homeworkId: { in: homeworks.map((homework) => homework.id) },
        status: { not: "deleted" },
      },
      _count: { _all: true },
    }),
  );

  const commentCounts = new Map(
    commentCountRows.flatMap((row: (typeof commentCountRows)[number]) =>
      row.homeworkId ? [[row.homeworkId, row._count._all] as const] : [],
    ),
  );

  return homeworks.map((homework) => {
    const { homeworkCompletions, ...rest } = homework;
    return {
      ...rest,
      completion: homeworkCompletions?.[0] ?? null,
      commentCount: commentCounts.get(homework.id) ?? 0,
    } as HomeworkItemWithState<T>;
  });
}
