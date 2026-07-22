import {
  DEMO_SESSION_COOKIE,
  isDemoModeEnabled,
  mintDemoApiToken,
  verifyDemoWebSession,
} from "@/features/demo/server/demo-auth";
import { jsonResponse, notFound, unauthorized } from "@/lib/api/responses";
import type { RequestHandler } from "./$types";

/**
 * Exchange a demo web session for a short-lived demo API token.
 * @response demoTokenResponseSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const POST: RequestHandler = async ({ cookies }) => {
  if (!isDemoModeEnabled()) return notFound();
  const session = cookies.get(DEMO_SESSION_COOKIE);
  const principal = session ? await verifyDemoWebSession(session) : null;
  if (!principal) return unauthorized();
  return jsonResponse(
    {
      accessToken: await mintDemoApiToken(principal.sessionId),
      expiresIn: 5 * 60,
      tokenType: "Bearer",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
};
