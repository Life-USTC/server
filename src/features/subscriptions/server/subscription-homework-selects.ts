import type { Prisma } from "@/generated/prisma/client";

export function buildSubscribedHomeworkInclude(
  userId: string,
  includeEditors: boolean,
) {
  return {
    section: { include: { course: true, semester: true } },
    description: true,
    homeworkCompletions: {
      where: { userId },
      select: { completedAt: true },
    },
    ...(includeEditors
      ? {
          createdBy: {
            select: { id: true, name: true, username: true, image: true },
          },
          updatedBy: {
            select: { id: true, name: true, username: true, image: true },
          },
          deletedBy: {
            select: { id: true, name: true, username: true, image: true },
          },
        }
      : {}),
  } satisfies Prisma.HomeworkInclude;
}

export function buildDashboardHomeworkSelect(userId: string) {
  return {
    id: true,
    title: true,
    publishedAt: true,
    submissionStartAt: true,
    submissionDueAt: true,
    description: { select: { content: true } },
    homeworkCompletions: { where: { userId }, select: { completedAt: true } },
    section: { select: { jwId: true, course: true } },
  } satisfies Prisma.HomeworkSelect;
}
