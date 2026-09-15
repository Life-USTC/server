import type { RequestHandler } from "@sveltejs/kit";
import {
  getYoungSubscriptionStateRoute,
  putYoungSubscriptionRoute,
} from "@/lib/api/routes/young-workspace-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
/**
 * Set personal events subscription state. This does not register attendance.
 * @body youngEventSubscriptionRequestSchema
 * @pathParams youngEventYoungIdPathParamsSchema
 * @response youngEventSubscriptionStateSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const PUT: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    putYoungSubscriptionRoute(request, params.youngId ?? "", "events"),
  )(request);
/**
 * Read personal activity subscription state.
 * @pathParams youngEventYoungIdPathParamsSchema
 * @response youngEventSubscriptionStateSchema
 * @response 401:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getYoungSubscriptionStateRoute(request, params.youngId ?? ""),
  )(request);
