import {
  getLatestComments,
  getPagePrisma,
  toLoadData,
} from "@/lib/page-data-utils";

export async function getCoursePage(jwId: number, locale = "zh-cn") {
  const prisma = await getPagePrisma(locale);
  const course = await prisma.course.findUnique({
    where: { jwId },
    select: {
      id: true,
      jwId: true,
      code: true,
      nameCn: true,
      nameEn: true,
      namePrimary: true,
      nameSecondary: true,
      educationLevel: {
        select: {
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
        },
      },
      category: {
        select: {
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
        },
      },
      classType: {
        select: {
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
        },
      },
      type: {
        select: {
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
        },
      },
      description: {
        select: { content: true, updatedAt: true, lastEditedAt: true },
      },
      sections: {
        orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
        select: {
          jwId: true,
          code: true,
          stdCount: true,
          limitCount: true,
          semester: { select: { nameCn: true } },
          campus: {
            select: {
              nameCn: true,
              nameEn: true,
              namePrimary: true,
              nameSecondary: true,
            },
          },
          teachers: {
            select: {
              nameCn: true,
              nameEn: true,
              namePrimary: true,
              nameSecondary: true,
            },
          },
        },
      },
    },
  });

  if (!course) return null;

  const [commentCount, latestComments] = await Promise.all([
    prisma.comment.count({
      where: { courseId: course.id, status: { not: "deleted" } },
    }),
    getLatestComments({ courseId: course.id }, 5, locale),
  ]);

  return toLoadData({ ...course, commentCount, latestComments });
}
