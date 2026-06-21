import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";

const homeworkItemUserSelect = {
  select: { id: true, name: true, username: true, image: true },
} as const;

export function homeworkItemIncludeForViewer(viewerUserId?: string | null) {
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
    ...(viewerUserId
      ? {
          homeworkCompletions: {
            where: { userId: viewerUserId },
            select: { completedAt: true },
          },
        }
      : {}),
  } satisfies Prisma.HomeworkInclude;
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
    include: homeworkItemIncludeForViewer(input.userId),
  });
  return homework ? homeworkItemResponse(homework) : null;
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
