/**
 * Opt-in OAuth / HTTP tracing for production debugging (dev-server–style visibility).
 *
 * - `OAUTH_DEBUG_LOGGING=1` — log `/api/auth/oauth2/*`, sanitized redirects, authorize summary; log `/api/mcp`.
 * - `OAUTH_DEBUG_LOGGING=verbose` (or `2`) — also log all other `/api/auth/*` routes.
 *
 * Never logs secrets, authorization codes, refresh tokens, access tokens, or cookies.
 */

export * from "./oauth-debug-mode";
export * from "./oauth-debug-sanitize";
export * from "./oauth-debug-wrapper";
