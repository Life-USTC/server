import { type RequestHandler, redirect } from "@sveltejs/kit";
import { applyAuthResponseCookies } from "@/lib/auth/svelte-auth-actions";

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { authApi } = await import("@/lib/auth/core");
  const response = await authApi.signOut({
    headers: request.headers,
    returnHeaders: true,
  });
  applyAuthResponseCookies(response.headers, cookies);
  throw redirect(303, "/");
};
