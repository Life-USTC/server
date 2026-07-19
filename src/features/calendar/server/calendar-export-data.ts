import { prisma } from "@/lib/db/prisma";

export const sectionCalendarInclude = {
  course: true,
  schedules: {
    include: {
      room: {
        include: {
          building: {
            include: {
              campus: true,
            },
          },
        },
      },
      teachers: true,
    },
  },
  exams: {
    include: {
      examRooms: true,
    },
  },
} as const;

export async function getIncompleteHomeworkCalendarItems(
  userId: string,
  sectionIds: number[],
) {
  if (sectionIds.length === 0) return [];

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

export async function getSectionForCalendar(sectionJwId: number) {
  return prisma.section.findUnique({
    where: { jwId: sectionJwId },
    include: sectionCalendarInclude,
  });
}

export async function getSectionsForCalendar(sectionIds: number[]) {
  return prisma.section.findMany({
    where: {
      id: {
        in: sectionIds,
      },
      retiredAt: null,
    },
    include: sectionCalendarInclude,
  });
}

export async function getUserCalendarAccessRecord(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      calendarFeedToken: true,
    },
  });
}

export async function getUserCalendarRecord(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscribedSections: {
        where: { retiredAt: null },
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
