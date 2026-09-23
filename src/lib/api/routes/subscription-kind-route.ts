import { updateSubscriptionKind } from "@/features/subscriptions/server/subscription-kind";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseInteger,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import {
  subscriptionKindUpdateRequestSchema,
  subscriptionKindUpdateResponseSchema,
} from "@/lib/api/schemas/subscription-kind-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

export async function patchSubscriptionKindRoute(
  request: Request,
  jwId: string | undefined,
) {
  try {
    const auth = await requireAuth(request, {
      bearerScope: { feature: "workspace.subscription", action: "write" },
      rateLimit: { action: "workspace.subscription:write" },
    });
    if (auth instanceof Response) return auth;
    const sectionJwId = parseInteger(jwId ?? "");
    if (sectionJwId === null || sectionJwId <= 0)
      return badRequest("Invalid section JW ID");
    const body = await parseRouteJsonBody(
      request,
      subscriptionKindUpdateRequestSchema,
      "Invalid subscription kind",
    );
    if (body instanceof Response) return body;
    const result = await updateSubscriptionKind({
      userId: auth.userId,
      sectionJwId,
      kind: body.kind,
    });
    return result
      ? jsonResponse(subscriptionKindUpdateResponseSchema.parse(result))
      : notFound("Subscription not found");
  } catch (error) {
    return handleRouteError("Failed to update subscription kind", error);
  }
}
