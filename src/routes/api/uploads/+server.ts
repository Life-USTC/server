import { getUploadsRoute, postUploadRoute } from "@/lib/api/routes/uploads";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List uploads.
 * @params uploadsQuerySchema
 * @response uploadsListResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getUploadsRoute));
/**
 * Create a signed upload URL.
 * @body uploadCreateRequestSchema
 * @response uploadCreateResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 413:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST = svelteRequestHandler(observedApiRoute(postUploadRoute));
