import { postUploadCompleteRoute } from "@/lib/api/routes/uploads";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Complete upload.
 * @body uploadCompleteRequestSchema
 * @response uploadCompleteResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postUploadCompleteRoute),
);
