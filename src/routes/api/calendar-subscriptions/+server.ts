import { postCalendarSubscriptionsRoute } from "@/lib/api/routes/calendar-subscriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Replace the current user's section subscriptions.
 * @body calendarSubscriptionCreateRequestSchema
 * @response calendarSubscriptionCreateResponseSchema
 * @response 400:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postCalendarSubscriptionsRoute),
);
