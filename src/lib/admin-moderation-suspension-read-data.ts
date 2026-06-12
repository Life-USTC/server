import type { AdminModerationPrisma } from "@/lib/admin-moderation-types";

export function listModerationSuspensions({
  pageSize,
  prisma,
}: {
  pageSize: number;
  prisma: AdminModerationPrisma;
}) {
  return prisma.userSuspension.findMany({
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
