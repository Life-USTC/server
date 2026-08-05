import { authPrisma } from "@/lib/db/auth-prisma";
import { getPrisma } from "@/lib/db/prisma";

export async function getAdminSummary(locale = "zh-cn") {
  const prisma = getPrisma(locale);
  const [users, comments, homeworks, oauthClients, suspensions] =
    await Promise.all([
      prisma.user.count(),
      prisma.comment.count(),
      prisma.homework.count(),
      authPrisma.oAuthClient.count(),
      prisma.userSuspension.count({ where: { liftedAt: null } }),
    ]);

  return { users, comments, homeworks, oauthClients, suspensions };
}
