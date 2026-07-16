import type { RequestHandler } from "@sveltejs/kit";
import { deleteAdminHomeworkRoute } from "@/lib/api/routes/admin";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Delete one homework.
 * @pathParams resourceIdPathParamsSchema
 * @response successResponseSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const DELETE: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => deleteAdminHomeworkRoute(request, { id: params.id }))(
    request,
  );
