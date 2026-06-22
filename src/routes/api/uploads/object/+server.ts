import { putUploadObjectRoute } from "@/lib/api/routes/upload-object-put-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Write upload object.
 * @params uploadObjectQuerySchema
 * @body binary
 * @response 200:successResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 413:openApiErrorSchema
 */
export const PUT: RequestHandler = ({ request }) =>
  observedApiRoute(putUploadObjectRoute)(request);
