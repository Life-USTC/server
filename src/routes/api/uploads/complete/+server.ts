import { postUploadCompleteRoute } from "@/lib/api/routes/uploads";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Finalize one upload after the R2 object write.
 * @body uploadCompleteRequestSchema
 * @response uploadCompleteResponseSchema
 * @response 400:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postUploadCompleteRoute),
);
