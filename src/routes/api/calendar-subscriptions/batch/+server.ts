import { postCalendarSubscriptionBatchRoute } from "@/lib/api/routes/calendar-subscriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Batch update calendar section subscriptions.
 * @body calendarSubscriptionBatchRequestSchema
 * @response calendarSubscriptionBatchResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postCalendarSubscriptionBatchRoute),
);
