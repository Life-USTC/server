import {
  getWorkspaceLinkPinnedSlugs,
  logWorkspaceLinkPinFailure,
  MAX_PINNED_LINKS,
  resolveCatalogLinkBySlug,
  sanitizeDashboardReturnTo,
  updateWorkspaceLinkPinState,
} from "@/features/catalog-links/server/catalog-link-service";
import { setWorkspaceLinkPinStatesBatch } from "@/features/catalog-links/server/workspace-link-pin-batch";
import { jsonResponse, parseRouteJsonBody } from "@/lib/api/helpers";
import {
  workspaceLinkPinBatchRequestSchema,
  workspaceLinkPinRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import { workspaceLinkPinResponseSchema } from "@/lib/api/schemas/response-schemas";
import { requireAuth } from "@/lib/auth/api-auth";
import { jsonOrRedirectForPinnedLinks } from "./workspace-link-pin-response";

export async function getDashboardLinkPinsRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.link-pin", action: "read" },
  });
  if (auth instanceof Response) return auth;

  return jsonResponse(
    workspaceLinkPinResponseSchema.parse({
      pinnedSlugs: await getWorkspaceLinkPinnedSlugs(auth.userId),
      maxPinnedLinks: MAX_PINNED_LINKS,
      error: null,
    }),
  );
}

export async function postWorkspaceLinkPinRoute(request: Request) {
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
  const parsedBody = workspaceLinkPinRequestSchema.safeParse({
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
  const link = resolveCatalogLinkBySlug(slug);

  if (!link) {
    return jsonOrRedirectForPinnedLinks({
      request,
      wantsJson,
      pinnedSlugs: [],
      returnTo,
    });
  }

  try {
    const pinnedSlugs = await updateWorkspaceLinkPinState({
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
    logWorkspaceLinkPinFailure({ action, error, slug });
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

export async function postWorkspaceLinkPinBatchRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.link-pin", action: "write" },
    rateLimit: { action: "workspace.link-pin:batch-write", tier: "batch" },
  });
  if (auth instanceof Response) return auth;

  const body = await parseRouteJsonBody(
    request,
    workspaceLinkPinBatchRequestSchema,
    "Invalid batch payload",
  );
  if (body instanceof Response) return body;

  try {
    const result = await setWorkspaceLinkPinStatesBatch({
      items: body.items,
      userId: auth.userId,
    });
    if (!result.ok) {
      return jsonResponse(
        workspaceLinkPinResponseSchema.parse({
          pinnedSlugs: [],
          maxPinnedLinks: MAX_PINNED_LINKS,
          error: `Invalid dashboard link slug: ${result.slug}`,
        }),
        { status: 400 },
      );
    }

    return jsonResponse(
      workspaceLinkPinResponseSchema.parse({
        pinnedSlugs: result.pinnedSlugs,
        maxPinnedLinks: MAX_PINNED_LINKS,
        error: null,
      }),
    );
  } catch (error) {
    const lastItem = body.items.at(-1);
    logWorkspaceLinkPinFailure({
      action: lastItem?.action ?? "pin",
      error,
      slug: body.items.map((item) => item.slug).join(","),
    });
    return jsonResponse(
      workspaceLinkPinResponseSchema.parse({
        pinnedSlugs: [],
        maxPinnedLinks: MAX_PINNED_LINKS,
        error: "Failed to update dashboard link pin state",
      }),
      { status: 500 },
    );
  }
}
