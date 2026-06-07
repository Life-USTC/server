import { replaceUserSectionSubscriptions } from "@/features/home/server/subscriptions";
import {
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { calendarSubscriptionCreateRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/helpers";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Replace the current user's section subscriptions.
 * @body calendarSubscriptionCreateRequestSchema
 * @response calendarSubscriptionCreateResponseSchema
 * @response 400:openApiErrorSchema
 */
async function postRoute(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const parsedBody = await parseRouteJsonBody(
      request,
      calendarSubscriptionCreateRequestSchema,
      "Invalid subscription request",
    );
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const sectionIds = parsedBody.sectionIds ?? [];
    const subscription = await replaceUserSectionSubscriptions(
      userId,
      sectionIds,
    );

    return jsonResponse({
      subscription,
    });
  } catch (error) {
    return handleRouteError("Failed to update calendar subscription", error);
  }
}
export const POST = observedApiRoute(postRoute);
