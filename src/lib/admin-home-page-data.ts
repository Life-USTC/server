import { getPrismaClient, requireAdminPage } from "@/lib/admin-page-auth";

export async function getAdminHomeData(request: Request) {
  await requireAdminPage(request);
  const prisma = await getPrismaClient();
  const [
    users,
    comments,
    activeComments,
    deletedComments,
    homeworks,
    oauthClients,
    suspensions,
    busVersions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.comment.count(),
    prisma.comment.count({ where: { status: "active" } }),
    prisma.comment.count({ where: { status: "deleted" } }),
    prisma.homework.count({ where: { deletedAt: null } }),
    prisma.oAuthClient.count(),
    prisma.userSuspension.count({ where: { liftedAt: null } }),
    prisma.busScheduleVersion.count(),
  ]);

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
  const { getPrisma } = await import("@/lib/db/prisma");
  const prisma = getPrisma(locale);
  const [users, comments, homeworks, oauthClients, suspensions] =
    await Promise.all([
      prisma.user.count(),
      prisma.comment.count(),
      prisma.homework.count(),
      prisma.oAuthClient.count(),
      prisma.userSuspension.count({ where: { liftedAt: null } }),
    ]);

  return { users, comments, homeworks, oauthClients, suspensions };
}
