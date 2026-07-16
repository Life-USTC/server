import {
  logDashboardLinkPinFailure,
  MAX_PINNED_LINKS,
  resolveDashboardLinkBySlug,
  sanitizeDashboardReturnTo,
  updateDashboardLinkPinState,
} from "@/features/dashboard-links/server/dashboard-link-service";
import { jsonResponse, parseRouteJsonBody } from "@/lib/api/helpers";
import {
  dashboardLinkPinBatchRequestSchema,
  dashboardLinkPinRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import { dashboardLinkPinResponseSchema } from "@/lib/api/schemas/response-schemas";
import { requireAuth } from "@/lib/auth/api-auth";
import { jsonOrRedirectForPinnedLinks } from "./dashboard-link-pin-response";

export async function postDashboardLinkPinRoute(request: Request) {
  const wantsJson =
    request.headers.get("accept")?.includes("application/json") ?? false;
  const auth = await requireAuth(request, {
    bearerScope: { feature: "dashboard", action: "write" },
    rateLimit: { action: "dashboard:write" },
  });

  if (auth instanceof Response) {
    if (auth.status !== 401 && wantsJson) return auth;
    return jsonOrRedirectForPinnedLinks({
      request,
      wantsJson,
      pinnedSlugs: [],
      returnTo: "/",
      status: auth.status,
      error: auth.status === 429 ? "Rate limit exceeded" : null,
    });
  }
  const { userId } = auth;

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

export async function postDashboardLinkPinBatchRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "dashboard", action: "write" },
    rateLimit: { action: "dashboard:batch-write", tier: "batch" },
  });
  if (auth instanceof Response) return auth;

  const body = await parseRouteJsonBody(
    request,
    dashboardLinkPinBatchRequestSchema,
    "Invalid batch payload",
  );
  if (body instanceof Response) return body;

  for (const item of body.items) {
    const link = resolveDashboardLinkBySlug(item.slug);
    if (!link) {
      return jsonResponse(
        dashboardLinkPinResponseSchema.parse({
          pinnedSlugs: [],
          maxPinnedLinks: MAX_PINNED_LINKS,
          error: `Invalid dashboard link slug: ${item.slug}`,
        }),
        { status: 400 },
      );
    }
  }

  try {
    let pinnedSlugs: string[] = [];
    for (const item of body.items) {
      pinnedSlugs = await updateDashboardLinkPinState({
        action: item.action,
        slug: item.slug,
        userId: auth.userId,
      });
    }

    return jsonResponse(
      dashboardLinkPinResponseSchema.parse({
        pinnedSlugs,
        maxPinnedLinks: MAX_PINNED_LINKS,
        error: null,
      }),
    );
  } catch (error) {
    const lastItem = body.items.at(-1);
    logDashboardLinkPinFailure({
      action: lastItem?.action ?? "pin",
      error,
      slug: body.items.map((item) => item.slug).join(","),
      userId: auth.userId,
    });
    return jsonResponse(
      dashboardLinkPinResponseSchema.parse({
        pinnedSlugs: [],
        maxPinnedLinks: MAX_PINNED_LINKS,
        error: "Failed to update dashboard link pin state",
      }),
      { status: 500 },
    );
  }
}
