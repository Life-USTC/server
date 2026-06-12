import type { RequestHandler } from "@sveltejs/kit";
import { getUploadDownloadRoute } from "@/lib/api/routes/uploads";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Redirect to signed URL for one upload.
 * @pathParams resourceIdPathParamsSchema
 * @response 302
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getUploadDownloadRoute(request, { id: params.id }))(
    request,
  );
