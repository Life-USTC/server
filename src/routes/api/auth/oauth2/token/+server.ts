import { tokenGetRoute, tokenPostRoute } from "@/lib/api/routes/auth-token";
import { svelteRequestHandler } from "@/lib/api/svelte-route";

/**
 * Exchange OAuth 2.0 authorization/device/refresh grants for tokens.
 * @body oauthTokenRequestSchema
 * @response 200:oauthTokenResponseSchema
 * @response 400:oauthErrorResponseSchema
 * @response 401:oauthErrorResponseSchema
 */
export const POST = svelteRequestHandler(tokenPostRoute);

/**
 * Return method guidance for OAuth token clients.
 * @response 405:oauthErrorResponseSchema
 */
export const GET = svelteRequestHandler(tokenGetRoute);
