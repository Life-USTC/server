import { resolveDemoBoundary } from "@/features/demo/server/demo-request-boundary";
import {
  createDemoSession,
  setDemoCookie,
} from "@/features/demo/server/demo-session";
import { DEMO_ENTER_PATH } from "@/lib/auth/demo-request-signal";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies, request, url }) => {
  const boundary = await resolveDemoBoundary(request, DEMO_ENTER_PATH);
  if (boundary.response) return boundary.response;
  setDemoCookie(cookies, await createDemoSession(), url);
  return new Response(null, {
    status: 303,
    headers: { Location: "/workspace/todos" },
  });
};
