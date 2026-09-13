import type { RequestHandler } from "@sveltejs/kit";
import { patchSubscriptionKindRoute } from "@/lib/api/routes/subscription-kind-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Update an existing subscription's personal kind.
 * @pathParams jwIdPathParamsSchema
 * @body subscriptionKindUpdateRequestSchema
 * @response subscriptionKindUpdateResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const PATCH: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => patchSubscriptionKindRoute(request, params.jwId))(
    request,
  );
