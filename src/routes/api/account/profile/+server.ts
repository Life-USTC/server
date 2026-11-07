import { getDemoAccountProfile } from "@/features/demo/server/demo-profile";
import { privateSessionJson } from "@/lib/api/internal-session-response";
import { getAccountProfileRoute } from "@/lib/api/routes/account-profile-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Get the current account profile.
 * @response meResponseSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @oauthScope account.profile:read
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? privateSessionJson(
        getDemoAccountProfile(event.locals.demo, event.locals.locale),
      )
    : svelteRequestHandler(observedApiRoute(getAccountProfileRoute))(event);
