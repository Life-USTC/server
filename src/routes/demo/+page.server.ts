import { error, redirect } from "@sveltejs/kit";
import {
  DEMO_SESSION_COOKIE,
  isDemoModeEnabled,
  mintDemoWebSession,
  verifyDemoWebSession,
} from "@/features/demo/server/demo-auth";
import { getDemoTodos } from "@/features/demo/server/demo-fixtures";
import { checkDemoRateLimit } from "@/features/demo/server/demo-rate-limit";
import type { Actions, PageServerLoad } from "./$types";

function requireDemoEnabled() {
  if (!isDemoModeEnabled()) error(404, "Not found");
}

export const load: PageServerLoad = async ({ cookies }) => {
  requireDemoEnabled();
  const token = cookies.get(DEMO_SESSION_COOKIE);
  const principal = token ? await verifyDemoWebSession(token) : null;
  return {
    authenticated: Boolean(principal),
    todos: principal ? getDemoTodos(principal) : [],
  };
};

export const actions: Actions = {
  default: async ({ cookies, request, url }) => {
    requireDemoEnabled();
    const rateLimit = await checkDemoRateLimit(request, "bootstrap");
    if (!rateLimit.allowed) {
      error(
        rateLimit.reason === "limited" ? 429 : 503,
        rateLimit.reason === "limited"
          ? "Demo rate limit exceeded"
          : "Demo rate limiting unavailable",
      );
    }
    cookies.set(DEMO_SESSION_COOKIE, await mintDemoWebSession(), {
      httpOnly: true,
      maxAge: 15 * 60,
      path: "/",
      sameSite: "lax",
      secure: url.protocol === "https:",
    });
    throw redirect(303, "/demo");
  },
};
