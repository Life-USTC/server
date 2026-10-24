import { postLocaleRoute } from "@/lib/api/routes/locale";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Update user locale cookie.
 * @body localeUpdateRequestSchema
 * @response successResponseSchema
 * @response 400:openApiErrorSchema
 */
export const POST: RequestHandler = (event) =>
  event.locals.demo
    ? postLocaleRoute(event.request)
    : svelteRequestHandler(observedApiRoute(postLocaleRoute))(event);
