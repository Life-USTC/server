import { getLatestComments } from "@/features/comments/server/latest-comments";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";

export async function getTeacherPage(id: number, locale = "zh-cn") {
  const prisma = getPrisma(locale);
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: {
      id: true,
      nameCn: true,
      nameEn: true,
      namePrimary: true,
      nameSecondary: true,
      email: true,
      telephone: true,
      mobile: true,
      address: true,
      department: {
        select: {
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
        },
      },
      teacherTitle: {
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
        orderBy: [
          { semester: { jwId: "desc" } },
          { course: { nameCn: "asc" } },
        ],
        select: {
          jwId: true,
          code: true,
          credits: true,
          course: {
            select: {
              nameCn: true,
              nameEn: true,
              namePrimary: true,
              nameSecondary: true,
            },
          },
          semester: { select: { nameCn: true } },
        },
      },
    },
  });

  if (!teacher) return null;

  const [commentCount, latestComments] = await Promise.all([
    prisma.comment.count({
      where: { teacherId: teacher.id, status: { not: "deleted" } },
    }),
    getLatestComments({ teacherId: teacher.id }, 5, locale),
  ]);

  return toLoadData({ ...teacher, commentCount, latestComments });
}
