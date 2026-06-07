import {
  jsonOrRedirectForPinnedLinks,
  MAX_PINNED_LINKS,
  resolveDashboardLinkBySlug,
  sanitizeDashboardReturnTo,
} from "@/features/dashboard-links/server/route-helpers";
import { dashboardLinkPinRequestSchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { logAppEvent } from "@/lib/log/app-logger";

export const dynamic = "force-dynamic";

/**
 * Pin or unpin one dashboard link for the current user.
 * @body dashboardLinkPinRequestSchema
 * @response 303
 */
async function postRoute(request: Request) {
  const wantsJson =
    request.headers.get("accept")?.includes("application/json") ?? false;
  const formData = await request.formData();
  const parsedBody = dashboardLinkPinRequestSchema.safeParse({
    slug: formData.get("slug"),
    returnTo: formData.get("returnTo"),
    action: formData.get("action"),
  });

  if (!parsedBody.success) {
    return jsonOrRedirectForPinnedLinks({
      request,
      wantsJson,
      pinnedSlugs: [],
      returnTo: "/",
      status: 400,
    });
  }

  const { slug } = parsedBody.data;
  const returnTo = sanitizeDashboardReturnTo(parsedBody.data.returnTo);
  const action = parsedBody.data.action === "unpin" ? "unpin" : "pin";
  const link = resolveDashboardLinkBySlug(slug);

  if (!link) {
    return jsonOrRedirectForPinnedLinks({
      request,
      wantsJson,
      pinnedSlugs: [],
      returnTo,
    });
  }

  const userId = await resolveApiUserId(request);

  if (!userId) {
    return jsonOrRedirectForPinnedLinks({
      request,
      wantsJson,
      pinnedSlugs: [],
      returnTo,
      status: 401,
    });
  }

  let pinnedSlugs: string[] = [];

  try {
    if (action === "pin") {
      pinnedSlugs = await prisma.$transaction(async (tx) => {
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

        const finalRows = await tx.dashboardLinkPin.findMany({
          where: { userId },
          select: { slug: true },
        });
        return finalRows.map((row) => row.slug);
      });
    } else {
      await prisma.dashboardLinkPin.deleteMany({
        where: { userId, slug },
      });

      const finalRows = await prisma.dashboardLinkPin.findMany({
        where: { userId },
        select: { slug: true },
      });
      pinnedSlugs = finalRows.map((row) => row.slug);
    }
  } catch (error) {
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
    return jsonOrRedirectForPinnedLinks({
      request,
      wantsJson,
      pinnedSlugs: [],
      returnTo,
      status: 500,
      error: "Failed to update dashboard link pin state",
    });
  }

  return jsonOrRedirectForPinnedLinks({
    request,
    wantsJson,
    pinnedSlugs,
    returnTo,
  });
}
export const POST = observedApiRoute(postRoute);
