import type { RequestHandler } from "@sveltejs/kit";
import { postYoungNotificationReadRoute } from "@/lib/api/routes/young-workspace-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
/**
 * Mark a personal activity notification read.
 * @pathParams resourceIdPathParamsSchema
 * @response youngNotificationReadSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    postYoungNotificationReadRoute(request, params.id ?? ""),
  )(request);
