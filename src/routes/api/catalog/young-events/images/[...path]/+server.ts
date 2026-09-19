import type { RequestHandler } from "@sveltejs/kit";
import { getCloudflareTaskScheduler } from "@/lib/adapters/cloudflare-runtime";
import { getYoungEventImageByPathRoute } from "@/lib/api/routes/young-event-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Serve a cached rich-text inline image for second-classroom (Young) events by
 * its upstream pic path.
 * @response binary
 * @response 304
 * @response 404:openApiErrorSchema
 * @response 502:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params, platform }) =>
  observedApiRoute(() =>
    getYoungEventImageByPathRoute(
      request,
      { path: params.path ?? "" },
      { defer: getCloudflareTaskScheduler(platform) },
    ),
  )(request);
