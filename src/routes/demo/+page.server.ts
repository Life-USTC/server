import { error, redirect } from "@sveltejs/kit";
import {
  DEMO_SESSION_COOKIE,
  isDemoModeEnabled,
  mintDemoWebSession,
  verifyDemoWebSession,
} from "@/features/demo/server/demo-auth";
import { getDemoTodos } from "@/features/demo/server/demo-fixtures";
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
  default: async ({ cookies, url }) => {
    requireDemoEnabled();
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
