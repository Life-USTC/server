import type { AdminModerationPrisma } from "@/features/admin/server/admin-moderation-types";
import type { Prisma } from "@/generated/prisma/client";

export function listModerationSuspensions({
  pageSize,
  prisma,
  suspensionWhere,
}: {
  pageSize: number;
  prisma: AdminModerationPrisma;
  suspensionWhere: Prisma.UserSuspensionWhereInput;
}) {
  return prisma.userSuspension.findMany({
    where: suspensionWhere,
    select: {
      id: true,
      reason: true,
      note: true,
      createdAt: true,
      expiresAt: true,
      liftedAt: true,
      user: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: pageSize,
  });
}
