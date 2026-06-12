import { getUploadsRoute, postUploadRoute } from "@/lib/api/routes/uploads";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List uploads of current user.
 * @response uploadsListResponseSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getUploadsRoute));
/**
 * Create a signed upload URL.
 * @body uploadCreateRequestSchema
 * @response uploadCreateResponseSchema
 * @response 400:openApiErrorSchema
 */
export const POST = svelteRequestHandler(observedApiRoute(postUploadRoute));
