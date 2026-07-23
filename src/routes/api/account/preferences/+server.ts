import { postLocaleRoute } from "@/lib/api/routes/locale";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Update user locale cookie.
 * @body localeUpdateRequestSchema
 * @response successResponseSchema
 * @response 400:openApiErrorSchema
 */
export const POST = svelteRequestHandler(observedApiRoute(postLocaleRoute));
