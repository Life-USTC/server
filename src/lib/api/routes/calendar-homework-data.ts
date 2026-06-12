async function getPrismaClient() {
  const { prisma } = await import("@/lib/db/prisma");
  return prisma;
}

export async function getIncompleteHomeworkCalendarItems(
  userId: string,
  sectionIds: number[],
) {
  if (sectionIds.length === 0) return [];

  const prisma = await getPrismaClient();
  return prisma.homework.findMany({
    where: {
      deletedAt: null,
      sectionId: { in: sectionIds },
      submissionDueAt: { not: null },
      homeworkCompletions: {
        none: {
          userId,
        },
      },
    },
    include: {
      description: {
        select: {
          content: true,
        },
      },
      section: {
        include: {
          course: true,
        },
      },
    },
    orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
  });
}
