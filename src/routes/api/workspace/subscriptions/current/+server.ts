import { getCurrentCalendarSubscriptionRoute } from "@/lib/api/routes/calendar-subscriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get section subscriptions.
 * @response currentCalendarSubscriptionResponseSchema
 * @response 401:openApiErrorSchema
 * @oauthScope workspace.subscription:read
 * @oauthOptionalScope workspace.calendar-feed:read
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getCurrentCalendarSubscriptionRoute),
);
