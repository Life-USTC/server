import type { RequestHandler } from "@sveltejs/kit";
import { getUploadDownloadRoute } from "@/lib/api/routes/uploads";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Download upload.
 * @pathParams resourceIdPathParamsSchema
 * @response 200:binary
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getUploadDownloadRoute(request, { id: params.id }))(
    request,
  );
