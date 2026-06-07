import { getUserCalendarSubscription } from "@/features/home/server/subscription-read-model";
import { handleRouteError, jsonResponse } from "@/lib/api/helpers";
import { requireAuth } from "@/lib/auth/helpers";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Get the current user's section subscriptions.
 * @response currentCalendarSubscriptionResponseSchema
 * @response 401:openApiErrorSchema
 */
async function getRoute(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const subscription = await getUserCalendarSubscription(userId);

    if (!subscription) {
      return jsonResponse({ subscription: null });
    }

    return jsonResponse({ subscription });
  } catch (error) {
    return handleRouteError("Failed to fetch calendar subscription", error);
  }
}
export const GET = observedApiRoute(getRoute);
