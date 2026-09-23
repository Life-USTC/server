import type { RequestHandler } from "@sveltejs/kit";
import { getCloudflareTaskScheduler } from "@/lib/adapters/cloudflare-runtime";
import { getYoungEventImageRoute } from "@/lib/api/routes/young-event-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Serve the cached poster image for a second-classroom (Young) signup event.
 * @pathParams youngEventYoungIdPathParamsSchema
 * @response binary
 * @response 304
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 502:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params, platform }) =>
  observedApiRoute(() =>
    getYoungEventImageRoute(
      request,
      { youngId: params.youngId },
      { defer: getCloudflareTaskScheduler(platform) },
    ),
  )(request);
