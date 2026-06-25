import { getUploadsRoute, postUploadRoute } from "@/lib/api/routes/uploads";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List uploads.
 * @response uploadsListResponseSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getUploadsRoute));
/**
 * Create a signed upload URL.
 * @body uploadCreateRequestSchema
 * @response uploadCreateResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 413:openApiErrorSchema
 */
export const POST = svelteRequestHandler(observedApiRoute(postUploadRoute));
