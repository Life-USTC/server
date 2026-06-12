import type { Prisma } from "@/generated/prisma/client";
import type { AdminModerationPrisma } from "@/lib/admin-moderation-types";

export function listModerationComments({
  commentWhere,
  pageSize,
  prisma,
}: {
  commentWhere: Prisma.CommentWhereInput;
  pageSize: number;
  prisma: AdminModerationPrisma;
}) {
  return prisma.comment.findMany({
    where: commentWhere,
    select: {
      id: true,
      body: true,
      authorName: true,
      status: true,
      isAnonymous: true,
      moderationNote: true,
      createdAt: true,
      userId: true,
      user: { select: { id: true, name: true, username: true } },
      course: { select: { jwId: true, code: true, nameCn: true } },
      section: {
        select: {
          jwId: true,
          code: true,
          course: { select: { nameCn: true } },
        },
      },
      teacher: { select: { id: true, nameCn: true } },
      homework: { select: { id: true, title: true } },
      sectionTeacher: {
        select: {
          section: {
            select: {
              jwId: true,
              code: true,
              course: { select: { nameCn: true } },
            },
          },
          teacher: { select: { nameCn: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: pageSize,
  });
}
