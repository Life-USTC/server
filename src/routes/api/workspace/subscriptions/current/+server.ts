import {
  getCurrentCalendarSubscriptionRoute,
  getDemoCurrentCalendarSubscriptionRoute,
} from "@/lib/api/routes/calendar-subscriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Get section subscriptions.
 * @response currentCalendarSubscriptionResponseSchema
 * @response 401:openApiErrorSchema
 * @oauthScope workspace.subscription:read
 * @oauthOptionalScope workspace.calendar-feed:read
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoCurrentCalendarSubscriptionRoute(
        event.locals.demo,
        event.locals.locale,
      )
    : svelteRequestHandler(
        observedApiRoute(getCurrentCalendarSubscriptionRoute),
      )(event);
