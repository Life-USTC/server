import { getLatestComments } from "@/features/comments/server/latest-comments";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";
import { resolveCourseIdByJwId } from "./course-jw-id";

export async function getCoursePage(jwId: number, locale = "zh-cn") {
  const prisma = getPrisma(locale);
  const courseId = await resolveCourseIdByJwId(prisma, jwId);
  if (courseId == null) return null;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
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
