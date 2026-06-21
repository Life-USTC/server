import { postCalendarSubscriptionImportCodesRoute } from "@/lib/api/routes/calendar-subscriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Import section subscriptions by section codes.
 * @body matchSectionCodesRequestSchema
 * @response calendarSubscriptionImportResponseSchema
 * @response 401:openApiErrorSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postCalendarSubscriptionImportCodesRoute),
);
