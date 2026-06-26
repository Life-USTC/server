import type { RequestHandler } from "@sveltejs/kit";
import { patchAdminCommentRoute } from "@/lib/api/routes/admin";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Moderate one comment.
 * @pathParams resourceIdPathParamsSchema
 * @body adminModerateCommentRequestSchema
 * @response adminModeratedCommentResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const PATCH: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => patchAdminCommentRoute(request, { id: params.id }))(
    request,
  );
