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
