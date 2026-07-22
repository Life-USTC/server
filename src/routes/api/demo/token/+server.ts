import { json } from "@sveltejs/kit";
import {
  DEMO_SESSION_COOKIE,
  isDemoModeEnabled,
  mintDemoApiToken,
  verifyDemoWebSession,
} from "@/features/demo/server/demo-auth";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies }) => {
  if (!isDemoModeEnabled()) return new Response("Not found", { status: 404 });
  const session = cookies.get(DEMO_SESSION_COOKIE);
  const principal = session ? await verifyDemoWebSession(session) : null;
  if (!principal) return new Response("Unauthorized", { status: 401 });
  return json({
    accessToken: await mintDemoApiToken(principal.sessionId),
    expiresIn: 5 * 60,
    tokenType: "Bearer",
  });
};
