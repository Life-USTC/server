import { setDashboardLinkPinStatesBatch } from "@/features/dashboard-links/server/dashboard-link-pin-batch";
import {
  getDashboardLinkPinnedSlugs,
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

export async function getDashboardLinkPinsRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.link-pin", action: "read" },
  });
  if (auth instanceof Response) return auth;

  return jsonResponse(
    dashboardLinkPinResponseSchema.parse({
      pinnedSlugs: await getDashboardLinkPinnedSlugs(auth.userId),
      maxPinnedLinks: MAX_PINNED_LINKS,
      error: null,
    }),
  );
}

export async function postDashboardLinkPinRoute(request: Request) {
  const wantsJson =
    request.headers.get("accept")?.includes("application/json") ?? false;
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.link-pin", action: "write" },
    rateLimit: { action: "workspace.link-pin:write" },
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
    logDashboardLinkPinFailure({ action, error, slug });
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
    bearerScope: { feature: "workspace.link-pin", action: "write" },
    rateLimit: { action: "dashboard:batch-write", tier: "batch" },
  });
  if (auth instanceof Response) return auth;

  const body = await parseRouteJsonBody(
    request,
    dashboardLinkPinBatchRequestSchema,
    "Invalid batch payload",
  );
  if (body instanceof Response) return body;

  try {
    const result = await setDashboardLinkPinStatesBatch({
      items: body.items,
      userId: auth.userId,
    });
    if (!result.ok) {
      return jsonResponse(
        dashboardLinkPinResponseSchema.parse({
          pinnedSlugs: [],
          maxPinnedLinks: MAX_PINNED_LINKS,
          error: `Invalid dashboard link slug: ${result.slug}`,
        }),
        { status: 400 },
      );
    }

    return jsonResponse(
      dashboardLinkPinResponseSchema.parse({
        pinnedSlugs: result.pinnedSlugs,
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
