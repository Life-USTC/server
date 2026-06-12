import { MAX_PINNED_LINKS } from "@/features/dashboard-links/server/route-helpers";

type DashboardLinkPinRow = { slug: string };

type DashboardLinkPinDelegate = {
  deleteMany: (input: {
    where: { userId: string; slug?: string | { in: string[] } };
  }) => Promise<unknown>;
  findMany: (input: {
    where: { userId: string };
    select: { slug: true };
    orderBy?: { createdAt: "asc" };
  }) => Promise<DashboardLinkPinRow[]>;
  upsert: (input: {
    where: { userId_slug: { userId: string; slug: string } };
    create: { userId: string; slug: string };
    update: Record<string, never>;
  }) => Promise<unknown>;
};

type DashboardLinkPinPrisma = {
  dashboardLinkPin: DashboardLinkPinDelegate;
};

type DashboardLinkPinTransactionPrisma = DashboardLinkPinPrisma & {
  $transaction: <Result>(
    callback: (tx: DashboardLinkPinPrisma) => Promise<Result>,
  ) => Promise<Result>;
};

export async function pinDashboardLink(
  prisma: DashboardLinkPinTransactionPrisma,
  userId: string,
  slug: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.dashboardLinkPin.upsert({
      where: { userId_slug: { userId, slug } },
      create: { userId, slug },
      update: {},
    });

    const pinnedRows = await tx.dashboardLinkPin.findMany({
      where: { userId },
      select: { slug: true },
      orderBy: { createdAt: "asc" },
    });
    const overflowRows = pinnedRows.slice(0, -MAX_PINNED_LINKS);

    if (overflowRows.length > 0) {
      await tx.dashboardLinkPin.deleteMany({
        where: {
          userId,
          slug: { in: overflowRows.map((row) => row.slug) },
        },
      });
    }

    return listDashboardLinkPins(tx, userId);
  });
}

export async function unpinDashboardLink(
  prisma: DashboardLinkPinPrisma,
  userId: string,
  slug: string,
) {
  await prisma.dashboardLinkPin.deleteMany({
    where: { userId, slug },
  });

  return listDashboardLinkPins(prisma, userId);
}

async function listDashboardLinkPins(
  prisma: DashboardLinkPinPrisma,
  userId: string,
) {
  const finalRows = await prisma.dashboardLinkPin.findMany({
    where: { userId },
    select: { slug: true },
  });
  return finalRows.map((row) => row.slug);
}
