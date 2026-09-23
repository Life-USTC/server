import {
  DEMO_SESSION_COOKIE,
  getDemoSessionAuditId,
  isDemoModeEnabled,
  mintDemoApiToken,
  verifyDemoWebSession,
} from "@/features/demo/server/demo-auth";
import { checkDemoRateLimit } from "@/features/demo/server/demo-rate-limit";
import {
  jsonResponse,
  notFound,
  rateLimitResponse,
  unauthorized,
} from "@/lib/api/responses";
import type { RequestHandler } from "./$types";

/**
 * Exchange a demo web session for a short-lived demo API token.
 * @response demoTokenResponseSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST: RequestHandler = async ({ cookies, request }) => {
  if (!isDemoModeEnabled()) return notFound();
  const session = cookies.get(DEMO_SESSION_COOKIE);
  const principal = session ? await verifyDemoWebSession(session) : null;
  if (!principal) return unauthorized();
  const rateLimit = await checkDemoRateLimit(
    request,
    "token",
    getDemoSessionAuditId(principal.sessionId),
  );
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.reason);
  return jsonResponse(
    {
      accessToken: await mintDemoApiToken(principal.sessionId),
      expiresIn: 5 * 60,
      tokenType: "Bearer",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
};
