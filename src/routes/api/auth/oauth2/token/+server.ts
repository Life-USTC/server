import { tokenGetRoute, tokenPostRoute } from "@/lib/api/routes/auth-token";
import { svelteRequestHandler } from "@/lib/api/svelte-route";

/**
 * Exchange OAuth 2.0 authorization/device/refresh grants for tokens.
 * @body oauthTokenRequestSchema
 * @response 200
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const POST = svelteRequestHandler(tokenPostRoute);

/**
 * Return method guidance for OAuth token clients.
 * @response 405:openApiErrorSchema
 */
export const GET = svelteRequestHandler(tokenGetRoute);
