async function getPrismaClient() {
  const { prisma } = await import("@/lib/db/prisma");
  return prisma;
}

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

export async function getSectionsForCalendar(sectionIds: number[]) {
  const prisma = await getPrismaClient();
  return prisma.section.findMany({
    where: {
      id: {
        in: sectionIds,
      },
    },
    include: sectionCalendarInclude,
  });
}

export async function getSectionForCalendar(sectionJwId: number) {
  const prisma = await getPrismaClient();
  return prisma.section.findUnique({
    where: { jwId: sectionJwId },
    include: sectionCalendarInclude,
  });
}
