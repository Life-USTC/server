import { resolveDashboardLinkBySlug } from "@/features/dashboard-links/server/route-helpers";
import { recordDashboardLinkClick } from "@/lib/api/routes/dashboard-link-actions";
import {
  dashboardLinkVisitQuerySchema,
  dashboardLinkVisitRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/api-auth";

function resolveVisitTarget(
  schema: typeof dashboardLinkVisitQuerySchema,
  slug: FormDataEntryValue | string | null,
) {
  const parsed = schema.safeParse({ slug });
  return parsed.success ? resolveDashboardLinkBySlug(parsed.data.slug) : null;
}

export async function getDashboardLinkVisitRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = resolveVisitTarget(
    dashboardLinkVisitQuerySchema,
    searchParams.get("slug"),
  );

  if (!target) {
    return Response.redirect(new URL("/", request.url), 307);
  }

  return Response.redirect(target.url, 307);
}

export async function postDashboardLinkVisitRoute(request: Request) {
  const formData = await request.formData();
  const target = resolveVisitTarget(
    dashboardLinkVisitRequestSchema,
    formData.get("slug"),
  );

  if (!target) {
    return Response.redirect(new URL("/", request.url), 303);
  }

  const userId = await resolveApiUserId(request);

  if (userId) {
    await recordDashboardLinkClick(userId, target.slug);
  }

  return Response.redirect(target.url, 303);
}
