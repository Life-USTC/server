import {
  deleteCalendarSubscriptionsRoute,
  patchCalendarSubscriptionsRoute,
  postCalendarSubscriptionsRoute,
} from "@/lib/api/routes/calendar-subscriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Replace section subscriptions.
 * @body calendarSubscriptionCreateRequestSchema
 * @response calendarSubscriptionCreateResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postCalendarSubscriptionsRoute),
);

/**
 * Append section subscriptions.
 * @body calendarSubscriptionAppendRequestSchema
 * @response calendarSubscriptionAppendResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const PATCH = svelteRequestHandler(
  observedApiRoute(patchCalendarSubscriptionsRoute),
);

/**
 * Remove section subscriptions.
 * @body calendarSubscriptionRemoveRequestSchema
 * @response calendarSubscriptionRemoveResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const DELETE = svelteRequestHandler(
  observedApiRoute(deleteCalendarSubscriptionsRoute),
);
