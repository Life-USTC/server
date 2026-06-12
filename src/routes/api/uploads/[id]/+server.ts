import type { RequestHandler } from "@sveltejs/kit";
import { deleteUploadRoute, patchUploadRoute } from "@/lib/api/routes/uploads";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Rename one upload.
 * @pathParams resourceIdPathParamsSchema
 * @body uploadRenameRequestSchema
 * @response uploadRenameResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const PATCH: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => patchUploadRoute(request, { id: params.id }))(request);

/**
 * Delete one upload.
 * @pathParams resourceIdPathParamsSchema
 * @response 200:uploadDeleteResponseSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const DELETE: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => deleteUploadRoute(request, { id: params.id }))(
    request,
  );
