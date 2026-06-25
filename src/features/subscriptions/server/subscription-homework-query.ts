import type { Prisma } from "@/generated/prisma/client";

export function buildSubscribedHomeworkQuery(input: {
  completed?: boolean;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  includeDeleted: boolean;
  limit?: number;
  requireDueDate: boolean;
  sectionIds: readonly number[];
  userId: string;
}) {
  return {
    where: {
      sectionId: { in: Array.from(input.sectionIds) },
      ...(input.includeDeleted ? {} : { deletedAt: null }),
      ...(input.completed === undefined
        ? {}
        : input.completed
          ? { homeworkCompletions: { some: { userId: input.userId } } }
          : { homeworkCompletions: { none: { userId: input.userId } } }),
      ...(input.requireDueDate ? { submissionDueAt: { not: null } } : {}),
      ...(input.dueAtFrom || input.dueAtTo
        ? {
            submissionDueAt: {
              ...(input.requireDueDate ? { not: null } : {}),
              ...(input.dueAtFrom ? { gte: input.dueAtFrom } : {}),
              ...(input.dueAtTo ? { lte: input.dueAtTo } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
    ...(input.limit ? { take: input.limit } : {}),
  } satisfies Prisma.HomeworkFindManyArgs;
}
