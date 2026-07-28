import type { getPrisma } from "@/lib/db/prisma";

type PagePrisma = ReturnType<typeof getPrisma>;

type SectionPageRelatedSection = {
  courseId: number;
  id: number;
  semesterId: number | null;
  teachers: Array<{ id: number }>;
};

const RELATED_SECTION_LIMIT = 10;

const relatedSectionSelect = {
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
} as const;

export async function getSectionPageRelatedData({
  prisma,
  section,
}: {
  prisma: PagePrisma;
  section: SectionPageRelatedSection;
}) {
  const teacherIds = section.teachers.map((teacher) => teacher.id);
  const [sameSemesterOtherTeachers, sameTeacherOtherSemesters] =
    await Promise.all([
      prisma.section.findMany({
        where: {
          courseId: section.courseId,
          id: { not: section.id },
          retiredAt: null,
          semesterId: section.semesterId,
          ...(teacherIds.length > 0
            ? { teachers: { none: { id: { in: teacherIds } } } }
            : {}),
        },
        orderBy: { code: "asc" },
        select: relatedSectionSelect,
        take: RELATED_SECTION_LIMIT,
      }),
      teacherIds.length > 0
        ? prisma.section.findMany({
            where: {
              courseId: section.courseId,
              id: { not: section.id },
              retiredAt: null,
              semesterId: { not: section.semesterId },
              teachers: { some: { id: { in: teacherIds } } },
            },
            orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
            select: relatedSectionSelect,
            take: RELATED_SECTION_LIMIT,
          })
        : Promise.resolve([]),
    ]);

  return {
    otherSections: [...sameSemesterOtherTeachers, ...sameTeacherOtherSemesters],
    sameSemesterOtherTeachers,
    sameTeacherOtherSemesters,
  };
}
