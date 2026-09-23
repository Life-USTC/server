import { getCurrentCalendarSubscriptionRoute } from "@/lib/api/routes/calendar-subscriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get section subscriptions.
 * @oauthScope workspace.subscription:read
 * @oauthScope workspace.calendar-feed:read
 * @response currentCalendarSubscriptionResponseSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getCurrentCalendarSubscriptionRoute),
);
