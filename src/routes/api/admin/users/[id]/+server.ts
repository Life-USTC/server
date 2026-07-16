import type { RequestHandler } from "@sveltejs/kit";
import { patchAdminUserRoute } from "@/lib/api/routes/admin";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Update one user.
 * @pathParams resourceIdPathParamsSchema
 * @body adminUpdateUserRequestSchema
 * @response adminUserResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const PATCH: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => patchAdminUserRoute(request, { id: params.id }))(
    request,
  );
