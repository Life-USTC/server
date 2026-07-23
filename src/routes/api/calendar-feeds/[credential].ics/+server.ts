import type { RequestHandler } from "@sveltejs/kit";
import { getCloudflareTaskScheduler } from "@/lib/adapters/cloudflare-runtime";
import { getUserCalendarRoute } from "@/lib/api/routes/calendars";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Deliver a token-bearing personal calendar feed.
 * @pathParams calendarFeedCredentialPathParamsSchema
 * @response 200:calendar
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params, platform }) =>
  observedApiRoute(() =>
    getUserCalendarRoute(
      request,
      { userId: params.credential },
      { defer: getCloudflareTaskScheduler(platform) },
    ),
  )(request);
