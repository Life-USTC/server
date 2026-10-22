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

export type HomeworkCommentCounts = ReadonlyMap<string, number>;

/**
 * Visible comment counts for a homework list, as a value a caller can hoist
 * into an RLS transaction it already holds open.
 */
export async function getHomeworkCommentCounts(
  homeworkIds: readonly string[],
  viewerUserId: string | null = null,
): Promise<HomeworkCommentCounts> {
  if (homeworkIds.length === 0) {
    return new Map();
  }

  const commentCountRows = await withCommentDbContext(viewerUserId, (client) =>
    client.comment.groupBy({
      by: ["homeworkId"],
      where: {
        homeworkId: { in: [...homeworkIds] },
        status: { not: "deleted" },
      },
      _count: { _all: true },
    }),
  );

  return new Map(
    commentCountRows.flatMap((row: (typeof commentCountRows)[number]) =>
      row.homeworkId ? [[row.homeworkId, row._count._all] as const] : [],
    ),
  );
}

export async function withHomeworkItemState<
  T extends HomeworkWithOptionalCompletions,
>(
  homeworks: T[],
  viewerUserId: string | null = null,
  precomputedCommentCounts?: HomeworkCommentCounts,
): Promise<Array<HomeworkItemWithState<T>>> {
  if (homeworks.length === 0) {
    return [];
  }

  const commentCounts =
    precomputedCommentCounts ??
    (await getHomeworkCommentCounts(
      homeworks.map((homework) => homework.id),
      viewerUserId,
    ));

  return homeworks.map((homework) => {
    const { homeworkCompletions, ...rest } = homework;
    return {
      ...rest,
      completion: homeworkCompletions?.[0] ?? null,
      commentCount: commentCounts.get(homework.id) ?? 0,
    } as HomeworkItemWithState<T>;
  });
}
