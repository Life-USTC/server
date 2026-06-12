import { getCurrentCalendarSubscriptionRoute } from "@/lib/api/routes/calendar-subscriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get the current user's section subscriptions.
 * @response currentCalendarSubscriptionResponseSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getCurrentCalendarSubscriptionRoute),
);
