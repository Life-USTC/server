import { patchAdminSuspensionRoute } from "@/lib/api/routes/admin-suspensions";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Lift one suspension.
 * @pathParams resourceIdPathParamsSchema
 * @response adminSuspensionResponseSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const PATCH: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => patchAdminSuspensionRoute(request, { id: params.id }))(
    request,
  );
