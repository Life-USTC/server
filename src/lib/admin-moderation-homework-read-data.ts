import type { Prisma } from "@/generated/prisma/client";
import type { AdminModerationPrisma } from "@/lib/admin-moderation-types";

export function listModerationHomeworks({
  homeworkWhere,
  pageSize,
  prisma,
}: {
  homeworkWhere: Prisma.HomeworkWhereInput;
  pageSize: number;
  prisma: AdminModerationPrisma;
}) {
  return prisma.homework.findMany({
    where: homeworkWhere,
    select: {
      id: true,
      title: true,
      deletedAt: true,
      createdAt: true,
      submissionDueAt: true,
      section: {
        select: {
          jwId: true,
          code: true,
          course: { select: { jwId: true, code: true, nameCn: true } },
        },
      },
      createdBy: { select: { id: true, name: true, username: true } },
      deletedBy: { select: { id: true, name: true, username: true } },
    },
    orderBy: [{ deletedAt: "desc" }, { createdAt: "desc" }],
    take: pageSize,
  });
}
