export async function resolveSectionTeacherId(
  sectionId: number,
  teacherId: number,
) {
  const { prisma } = await import("@/lib/db/prisma");
  const section = await prisma.section.findFirst({
    where: {
      id: sectionId,
      teachers: {
        some: { id: teacherId },
      },
    },
    select: { id: true },
  });

  if (!section) return null;

  const sectionTeacher = await prisma.sectionTeacher.upsert({
    where: {
      sectionId_teacherId: {
        sectionId,
        teacherId,
      },
    },
    update: {},
    create: { sectionId, teacherId },
  });

  return sectionTeacher.id as number;
}

export async function findSectionTeacherId(
  sectionId: number,
  teacherId: number,
) {
  const { prisma } = await import("@/lib/db/prisma");
  const sectionTeacher = await prisma.sectionTeacher.findUnique({
    where: {
      sectionId_teacherId: {
        sectionId,
        teacherId,
      },
    },
    select: { id: true },
  });

  return sectionTeacher?.id ?? null;
}

export async function findSectionTeacherTarget(
  sectionId: number,
  teacherId: number,
) {
  const { prisma } = await import("@/lib/db/prisma");
  const sectionTeacherId = await findSectionTeacherId(sectionId, teacherId);
  if (sectionTeacherId) {
    return { exists: true, id: sectionTeacherId } as const;
  }

  const section = await prisma.section.findFirst({
    where: {
      id: sectionId,
      teachers: {
        some: { id: teacherId },
      },
    },
    select: { id: true },
  });

  if (!section) {
    return { exists: false, id: null } as const;
  }

  return { exists: true, id: null } as const;
}
