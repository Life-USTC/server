import { resolveDemoBoundary } from "@/features/demo/server/demo-request-boundary";
import {
  DEMO_COOKIE_NAME,
  DEMO_EXIT_PATH,
} from "@/lib/auth/demo-request-signal";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies, request }) => {
  const boundary = await resolveDemoBoundary(request, DEMO_EXIT_PATH);
  if (boundary.response) return boundary.response;
  cookies.delete(DEMO_COOKIE_NAME, { path: "/" });
  return new Response(null, {
    status: 303,
    headers: { Location: "/account/sign-in" },
  });
};
