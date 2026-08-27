import type { Prisma } from "@/generated/prisma/client";
import { getPrisma, withUserDbContext } from "@/lib/db/prisma";

const homeworkItemUserSelect = {
  select: { id: true, name: true, username: true, image: true },
} as const;

/**
 * The section homework list projection deliberately contains only scalar
 * state and the comment aggregate needed by list surfaces. Descriptions,
 * section/course context, and editor relations belong to the detail read.
 */
export function homeworkItemSummarySelect() {
  return {
    id: true,
    title: true,
    isMajor: true,
    requiresTeam: true,
    publishedAt: true,
    submissionStartAt: true,
    submissionDueAt: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    sectionId: true,
    createdById: true,
    updatedById: true,
    deletedById: true,
    _count: {
      select: {
        comments: { where: { status: { not: "deleted" } } },
      },
    },
  } satisfies Prisma.HomeworkSelect;
}

export function homeworkItemInclude() {
  return {
    section: {
      include: {
        course: true,
        semester: true,
      },
    },
    description: true,
    createdBy: homeworkItemUserSelect,
    updatedBy: homeworkItemUserSelect,
    deletedBy: homeworkItemUserSelect,
    _count: {
      select: {
        comments: { where: { status: { not: "deleted" } } },
      },
    },
  } satisfies Prisma.HomeworkInclude;
}

export async function withHomeworkCompletionsForViewer<
  T extends { id: string },
>(
  homeworks: T[],
  viewerUserId?: string | null,
): Promise<Array<T & { homeworkCompletions: Array<{ completedAt: Date }> }>> {
  if (!viewerUserId || homeworks.length === 0) {
    return attachHomeworkCompletionsForViewer(homeworks, []);
  }

  const completions = await withUserDbContext(viewerUserId, (tx) =>
    tx.homeworkCompletion.findMany({
      where: {
        userId: viewerUserId,
        homeworkId: { in: homeworks.map((homework) => homework.id) },
      },
      select: { homeworkId: true, completedAt: true },
    }),
  );
  return attachHomeworkCompletionsForViewer(homeworks, completions);
}

export function attachHomeworkCompletionsForViewer<T extends { id: string }>(
  homeworks: T[],
  completions: Array<{ homeworkId: string; completedAt: Date }>,
): Array<T & { homeworkCompletions: Array<{ completedAt: Date }> }> {
  const completionByHomeworkId = new Map(
    completions.map(({ homeworkId, completedAt }) => [
      homeworkId,
      { completedAt },
    ]),
  );

  return homeworks.map((homework) => {
    const completion = completionByHomeworkId.get(homework.id);
    return {
      ...homework,
      homeworkCompletions: completion ? [completion] : [],
    };
  });
}

export function homeworkItemResponse<
  Homework extends {
    _count: { comments: number };
    homeworkCompletions?: Array<{ completedAt: Date | string | null }>;
  },
>(homework: Homework) {
  const { homeworkCompletions, _count, ...rest } = homework;
  return {
    ...rest,
    completion: homeworkCompletions?.[0] ?? null,
    commentCount: _count.comments,
  };
}

export async function getHomeworkItemById(input: {
  homeworkId: string;
  locale: string;
  userId?: string | null;
}) {
  const homework = await getPrisma(input.locale).homework.findUnique({
    where: { id: input.homeworkId },
    include: homeworkItemInclude(),
  });
  if (!homework) return null;

  const [homeworkWithCompletion] = await withHomeworkCompletionsForViewer(
    [homework],
    input.userId,
  );
  return homeworkItemResponse(homeworkWithCompletion);
}

export async function requireHomeworkItemById(
  input: Parameters<typeof getHomeworkItemById>[0],
) {
  const homework = await getHomeworkItemById(input);
  if (!homework) {
    throw new Error(`Homework ${input.homeworkId} was not found`);
  }
  return homework;
}
