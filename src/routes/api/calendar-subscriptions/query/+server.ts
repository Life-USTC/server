import { postCalendarSubscriptionQueryRoute } from "@/lib/api/routes/calendar-subscriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Query sections for calendar subscription changes.
 * @body calendarSubscriptionQueryRequestSchema
 * @response calendarSubscriptionQueryResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postCalendarSubscriptionQueryRoute),
);
