import { TEACHING_ASSISTANT_SUBSCRIPTION_KIND } from "@/features/homeworks/lib/homework-completion-state";
import type { Prisma } from "@/generated/prisma/client";

type HomeworkListWhereInput = {
  completed?: boolean;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  includeDeleted: boolean;
  incompleteOrHasDueDate?: boolean;
  now?: Date;
  requireDueDate: boolean;
  userId: string;
};

function teachingAssistantSubscriptionWhere(userId: string) {
  // The subscription kind is added by the subscription-kind migration. Keep
  // this helper local so query construction remains the only place that knows
  // how a pending TA homework is scoped.
  return {
    kind: TEACHING_ASSISTANT_SUBSCRIPTION_KIND,
    userId,
  } satisfies Prisma.UserSectionSubscriptionWhereInput;
}

function pendingHomeworkWhere(input: HomeworkListWhereInput) {
  const teachingAssistant = teachingAssistantSubscriptionWhere(input.userId);
  const pendingCompletion = {
    homeworkCompletions: { none: { userId: input.userId } },
  } satisfies Prisma.HomeworkWhereInput;

  return {
    AND: [
      pendingCompletion,
      {
        OR: [
          {
            section: {
              sectionSubscriptions: { none: teachingAssistant },
            },
          },
          {
            section: {
              sectionSubscriptions: { some: teachingAssistant },
            },
            OR: [
              { submissionDueAt: null },
              { submissionDueAt: { gt: input.now } },
            ],
          },
        ],
      },
    ],
  } satisfies Prisma.HomeworkWhereInput;
}

function buildHomeworkListWhere(input: HomeworkListWhereInput) {
  const where = {
    ...(input.includeDeleted ? {} : { deletedAt: null }),
    ...(input.incompleteOrHasDueDate
      ? {
          OR: [
            { homeworkCompletions: { none: { userId: input.userId } } },
            { submissionDueAt: { not: null } },
          ],
        }
      : {}),
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

  if (input.completed === false && input.now) {
    return {
      ...where,
      AND: [pendingHomeworkWhere(input)],
    } satisfies Prisma.HomeworkWhereInput;
  }

  return where;
}

const SUBSCRIBED_HOMEWORK_ORDER_BY = [
  { submissionDueAt: "asc" },
  { createdAt: "desc" },
] satisfies Prisma.HomeworkOrderByWithRelationInput[];

export function orderHomeworksById<T extends { id: string }>(
  homeworks: T[],
  homeworkIds: readonly string[],
) {
  const homeworkById = new Map(
    homeworks.map((homework) => [homework.id, homework]),
  );
  return homeworkIds.flatMap((homeworkId) => {
    const homework = homeworkById.get(homeworkId);
    return homework ? [homework] : [];
  });
}

export function buildSubscribedHomeworkQuery(input: {
  completed?: boolean;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  includeDeleted: boolean;
  incompleteOrHasDueDate?: boolean;
  limit?: number;
  now?: Date;
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
  now?: Date;
  semesterId?: number;
  userId: string;
}) {
  return {
    where: {
      section: {
        sectionSubscriptions: { some: { userId: input.userId } },
        ...(input.semesterId !== undefined
          ? { semesterId: input.semesterId }
          : {}),
      },
      ...buildHomeworkListWhere({
        completed: input.completed,
        dueAtFrom: input.dueAtFrom,
        dueAtTo: input.dueAtTo,
        includeDeleted: false,
        now: input.now,
        requireDueDate: false,
        userId: input.userId,
      }),
    },
    orderBy: SUBSCRIBED_HOMEWORK_ORDER_BY,
  } satisfies Prisma.HomeworkFindManyArgs;
}
