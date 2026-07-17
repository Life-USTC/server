import type { Prisma } from "@/generated/prisma/client";

type HomeworkListWhereInput = {
  completed?: boolean;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  includeDeleted: boolean;
  requireDueDate: boolean;
  userId: string;
};

function buildHomeworkListWhere(input: HomeworkListWhereInput) {
  return {
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
  } satisfies Prisma.HomeworkWhereInput;
}

const SUBSCRIBED_HOMEWORK_ORDER_BY = [
  { submissionDueAt: "asc" },
  { createdAt: "desc" },
] satisfies Prisma.HomeworkOrderByWithRelationInput[];

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
      ...buildHomeworkListWhere(input),
    },
    orderBy: SUBSCRIBED_HOMEWORK_ORDER_BY,
    ...(input.limit ? { take: input.limit } : {}),
  } satisfies Prisma.HomeworkFindManyArgs;
}

export function buildSubscribedHomeworkPageQuery(input: {
  completed?: boolean;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  semesterId?: number;
  userId: string;
}) {
  return {
    where: {
      section: {
        subscribedUsers: { some: { id: input.userId } },
        ...(input.semesterId !== undefined
          ? { semesterId: input.semesterId }
          : {}),
      },
      ...buildHomeworkListWhere({
        completed: input.completed,
        dueAtFrom: input.dueAtFrom,
        dueAtTo: input.dueAtTo,
        includeDeleted: false,
        requireDueDate: false,
        userId: input.userId,
      }),
    },
    orderBy: SUBSCRIBED_HOMEWORK_ORDER_BY,
  } satisfies Prisma.HomeworkFindManyArgs;
}
