import type { RequestHandler } from "@sveltejs/kit";
import { patchAdminSuspensionRoute } from "@/lib/api/routes/admin";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Lift one suspension.
 * @pathParams resourceIdPathParamsSchema
 * @response adminSuspensionResponseSchema
 * @response 404:openApiErrorSchema
 */
export const PATCH: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => patchAdminSuspensionRoute(request, { id: params.id }))(
    request,
  );
