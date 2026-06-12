import type { RequestHandler } from "@sveltejs/kit";
import { deleteAdminHomeworkRoute } from "@/lib/api/routes/admin";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Soft delete one homework (admin).
 * @pathParams resourceIdPathParamsSchema
 * @response successResponseSchema
 * @response 404:openApiErrorSchema
 */
export const DELETE: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => deleteAdminHomeworkRoute(request, { id: params.id }))(
    request,
  );
