import type { Prisma } from "@/generated/prisma/client";
import type { AdminModerationPrisma } from "@/lib/admin-moderation-types";

export function listModerationDescriptions({
  descriptionPageSize,
  descriptionWhere,
  prisma,
}: {
  descriptionPageSize: number;
  descriptionWhere: Prisma.DescriptionWhereInput;
  prisma: AdminModerationPrisma;
}) {
  return prisma.description.findMany({
    where: descriptionWhere,
    select: {
      id: true,
      content: true,
      updatedAt: true,
      lastEditedAt: true,
      course: { select: { jwId: true, code: true, nameCn: true } },
      section: {
        select: {
          jwId: true,
          code: true,
          course: { select: { nameCn: true } },
        },
      },
      teacher: { select: { id: true, nameCn: true } },
      homework: {
        select: {
          id: true,
          title: true,
          section: { select: { jwId: true } },
        },
      },
      lastEditedBy: { select: { id: true, name: true, username: true } },
    },
    orderBy: [{ lastEditedAt: "desc" }, { updatedAt: "desc" }],
    take: descriptionPageSize,
  });
}
