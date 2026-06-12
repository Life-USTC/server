import type { getPagePrisma } from "@/lib/page-data-utils";
import { getLatestComments } from "@/lib/page-data-utils";

type PagePrisma = Awaited<ReturnType<typeof getPagePrisma>>;

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
  locale,
  prisma,
  section,
}: {
  locale: string;
  prisma: PagePrisma;
  section: SectionPageRelatedSection;
}) {
  const teacherIds = new Set(section.teachers.map((teacher) => teacher.id));
  const [
    sectionCommentCount,
    courseCommentCount,
    sectionTeacherCommentCount,
    latestComments,
    otherSections,
  ] = await Promise.all([
    prisma.comment.count({
      where: { sectionId: section.id, status: { not: "deleted" } },
    }),
    prisma.comment.count({
      where: { courseId: section.courseId, status: { not: "deleted" } },
    }),
    prisma.comment.count({
      where: {
        sectionTeacher: { sectionId: section.id },
        status: { not: "deleted" },
      },
    }),
    getLatestComments({ sectionId: section.id }, 5, locale),
    prisma.section.findMany({
      where: { courseId: section.courseId, id: { not: section.id } },
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
    }),
  ]);

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
    commentCount:
      sectionCommentCount + courseCommentCount + sectionTeacherCommentCount,
    courseCommentCount,
    latestComments,
    otherSections,
    sameSemesterOtherTeachers,
    sameTeacherOtherSemesters,
    sectionCommentCount,
    sectionTeacherCommentCount,
  };
}
