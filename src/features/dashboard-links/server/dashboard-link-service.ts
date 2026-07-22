import { USTC_DASHBOARD_LINKS } from "@/features/dashboard-links/lib/dashboard-links";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";

export const MAX_PINNED_LINKS = 4;

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

function normalizeUserId(userId: string) {
  const normalized = userId.trim();
  if (!normalized) throw new Error("Dashboard link user ID is required");
  return normalized;
}

export function resolveDashboardLinkBySlug(slug: string | null | undefined) {
  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) return null;
  return (
    USTC_DASHBOARD_LINKS.find((link) => link.slug === normalizedSlug) ?? null
  );
}

export function sanitizeDashboardReturnTo(value: string | undefined): string {
  if (!value?.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  if (/[\\\r\n]/.test(value)) return "/";
  return value;
}

export async function recordDashboardLinkClick(userId: string, slug: string) {
  userId = normalizeUserId(userId);
  try {
    await withUserDbContext(userId, () =>
      prisma.dashboardLinkClick.upsert({
        where: {
          userId_slug: {
            userId,
            slug,
          },
        },
        create: {
          userId,
          slug,
          count: 1,
          lastClickedAt: new Date(),
        },
        update: {
          count: { increment: 1 },
          lastClickedAt: new Date(),
        },
      }),
    );
  } catch (error) {
    logAppEvent(
      "warn",
      "Failed to record dashboard link click",
      {
        source: "dashboard-links",
        userId,
        slug,
      },
      error,
    );
  }
}

export async function updateDashboardLinkPinState({
  action,
  slug,
  userId,
}: {
  action: "pin" | "unpin";
  slug: string;
  userId: string;
}) {
  userId = normalizeUserId(userId);
  return withUserDbContext(userId, () => {
    if (action === "pin") {
      return pinDashboardLink(prisma, userId, slug);
    }

    return unpinDashboardLink(prisma, userId, slug);
  });
}

export function logDashboardLinkPinFailure({
  action,
  error,
  slug,
  userId,
}: {
  action: "pin" | "unpin";
  error: unknown;
  slug: string;
  userId: string;
}) {
  logAppEvent(
    "error",
    "Failed to update dashboard link pin state",
    {
      source: "dashboard-links",
      userId,
      slug,
      action,
    },
    error,
  );
}

async function pinDashboardLink(
  prisma: DashboardLinkPinPrisma,
  userId: string,
  slug: string,
) {
  await prisma.dashboardLinkPin.upsert({
    where: { userId_slug: { userId, slug } },
    create: { userId, slug },
    update: {},
  });

  const pinnedRows = await prisma.dashboardLinkPin.findMany({
    where: { userId },
    select: { slug: true },
    orderBy: { createdAt: "asc" },
  });
  const overflowRows = pinnedRows.slice(0, -MAX_PINNED_LINKS);

  if (overflowRows.length > 0) {
    await prisma.dashboardLinkPin.deleteMany({
      where: {
        userId,
        slug: { in: overflowRows.map((row) => row.slug) },
      },
    });
  }

  return listDashboardLinkPins(prisma, userId);
}

async function unpinDashboardLink(
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
