import type { getPrisma } from "@/lib/db/prisma";

type PagePrisma = ReturnType<typeof getPrisma>;

type SectionPageRelatedSection = {
  courseId: number;
  id: number;
  semesterId: number | null;
  teachers: Array<{ id: number }>;
};

type OtherSection = {
  semesterId: number | null;
  teachers: Array<{ id: number }>;
};

export async function getSectionPageRelatedData({
  prisma,
  section,
}: {
  prisma: PagePrisma;
  section: SectionPageRelatedSection;
}) {
  const teacherIds = new Set(section.teachers.map((teacher) => teacher.id));
  const otherSections = await prisma.section.findMany({
    where: {
      courseId: section.courseId,
      id: { not: section.id },
      retiredAt: null,
    },
    orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
    select: {
      id: true,
      jwId: true,
      code: true,
      semesterId: true,
      semester: { select: { endDate: true, nameCn: true, startDate: true } },
      teachers: {
        select: {
          id: true,
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
        },
      },
    },
  });

  const sameSemesterOtherTeachers = otherSections.filter(
    (otherSection: OtherSection) =>
      otherSection.semesterId === section.semesterId &&
      !otherSection.teachers.some((teacher) => teacherIds.has(teacher.id)),
  );
  const sameTeacherOtherSemesters = otherSections.filter(
    (otherSection: OtherSection) =>
      otherSection.semesterId !== section.semesterId &&
      otherSection.teachers.some((teacher) => teacherIds.has(teacher.id)),
  );

  return {
    otherSections,
    sameSemesterOtherTeachers,
    sameTeacherOtherSemesters,
  };
}
