import { NextResponse } from "next/server";
import { resolveDashboardLinkBySlug } from "@/features/dashboard-links/server/route-helpers";
import {
  dashboardLinkVisitQuerySchema,
  dashboardLinkVisitRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { logAppEvent } from "@/lib/log/app-logger";

export const dynamic = "force-dynamic";

function resolveVisitTarget(
  schema: typeof dashboardLinkVisitQuerySchema,
  slug: FormDataEntryValue | string | null,
) {
  const parsed = schema.safeParse({ slug });
  return parsed.success ? resolveDashboardLinkBySlug(parsed.data.slug) : null;
}

/**
 * Redirect to one dashboard link without side effects.
 * @params dashboardLinkVisitQuerySchema
 * @response 307
 */
async function getRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = resolveVisitTarget(
    dashboardLinkVisitQuerySchema,
    searchParams.get("slug"),
  );

  if (!target) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(target.url);
}
export const GET = observedApiRoute(getRoute);

/**
 * Record one dashboard link visit and redirect.
 * @body dashboardLinkVisitRequestSchema
 * @response 303
 */
async function postRoute(request: Request) {
  const formData = await request.formData();
  const target = resolveVisitTarget(
    dashboardLinkVisitRequestSchema,
    formData.get("slug"),
  );

  if (!target) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const userId = await resolveApiUserId(request);

  if (userId) {
    try {
      await prisma.dashboardLinkClick.upsert({
        where: {
          userId_slug: {
            userId,
            slug: target.slug,
          },
        },
        create: {
          userId,
          slug: target.slug,
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
          slug: target.slug,
        },
        error,
      );
    }
  }

  return NextResponse.redirect(target.url, 303);
}
export const POST = observedApiRoute(postRoute);
