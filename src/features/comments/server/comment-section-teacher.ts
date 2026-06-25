import { prisma } from "@/lib/db/prisma";

export async function resolveSectionTeacherId(
  sectionId: number,
  teacherId: number,
) {
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
    update: { retiredAt: null },
    create: { sectionId, teacherId },
  });

  return sectionTeacher.id as number;
}

export async function findSectionTeacherId(
  sectionId: number,
  teacherId: number,
) {
  const sectionTeacher = await prisma.sectionTeacher.findUnique({
    where: {
      sectionId_teacherId: {
        sectionId,
        teacherId,
      },
    },
    select: { id: true, retiredAt: true },
  });

  return sectionTeacher && sectionTeacher.retiredAt === null
    ? sectionTeacher.id
    : null;
}

export async function findSectionTeacherTarget(
  sectionId: number,
  teacherId: number,
) {
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
