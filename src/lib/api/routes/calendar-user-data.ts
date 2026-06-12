import { sectionCalendarInclude } from "./calendar-section-data";

async function getPrismaClient() {
  const { prisma } = await import("@/lib/db/prisma");
  return prisma;
}

export async function getUserCalendarRecord(userId: string) {
  const prisma = await getPrismaClient();
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscribedSections: {
        include: sectionCalendarInclude,
      },
      todos: {
        where: {
          completed: false,
          dueAt: { not: null },
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          content: true,
          dueAt: true,
          priority: true,
        },
      },
    },
  });
}
