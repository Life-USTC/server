import { requireAdminPage } from "@/features/admin/server/admin-page-auth";
import { authPrisma } from "@/lib/db/auth-prisma";
import { getPrisma, withUserDbContext } from "@/lib/db/prisma";

export async function getAdminHomeData(request: Request) {
  const admin = await requireAdminPage(request);
  const [
    users,
    comments,
    activeComments,
    deletedComments,
    homeworks,
    oauthClients,
    suspensions,
    busVersions,
  ] = await withUserDbContext(admin.id, (tx) =>
    Promise.all([
      tx.user.count(),
      tx.comment.count(),
      tx.comment.count({ where: { status: "active" } }),
      tx.comment.count({ where: { status: "deleted" } }),
      tx.homework.count({ where: { deletedAt: null } }),
      authPrisma.oAuthClient.count(),
      tx.userSuspension.count({ where: { liftedAt: null } }),
      tx.busScheduleVersion.count(),
    ]),
  );

  return {
    summary: {
      users,
      comments,
      activeComments,
      deletedComments,
      homeworks,
      oauthClients,
      suspensions,
      busVersions,
    },
  };
}

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
