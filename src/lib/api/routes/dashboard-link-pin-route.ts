import {
  jsonOrRedirectForPinnedLinks,
  resolveDashboardLinkBySlug,
  sanitizeDashboardReturnTo,
} from "@/features/dashboard-links/server/route-helpers";
import {
  logDashboardLinkPinFailure,
  updateDashboardLinkPinState,
} from "@/lib/api/routes/dashboard-link-actions";
import { dashboardLinkPinRequestSchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/api-auth";

export async function postDashboardLinkPinRoute(request: Request) {
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

  try {
    const pinnedSlugs = await updateDashboardLinkPinState({
      action,
      slug,
      userId,
    });
    return jsonOrRedirectForPinnedLinks({
      request,
      wantsJson,
      pinnedSlugs,
      returnTo,
    });
  } catch (error) {
    logDashboardLinkPinFailure({ action, error, slug, userId });
    return jsonOrRedirectForPinnedLinks({
      request,
      wantsJson,
      pinnedSlugs: [],
      returnTo,
      status: 500,
      error: "Failed to update dashboard link pin state",
    });
  }
}
