import { logAppEvent } from "@/lib/log/app-logger";
import {
  pinDashboardLink,
  unpinDashboardLink,
} from "./dashboard-link-pin-state";

export async function recordDashboardLinkClick(userId: string, slug: string) {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.dashboardLinkClick.upsert({
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
    });
  } catch (error) {
    logAppEvent(
      "warn",
      "Failed to record dashboard link click",
      {
        source: "route-handler",
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
  const { prisma } = await import("@/lib/db/prisma");
  if (action === "pin") {
    return pinDashboardLink(prisma, userId, slug);
  }

  return unpinDashboardLink(prisma, userId, slug);
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
      source: "route-handler",
      userId,
      slug,
      action,
    },
    error,
  );
}
