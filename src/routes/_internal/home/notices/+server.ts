import { getDemoHomeInformation } from "@/features/demo/server/demo-home";
import { loadHomeNotices } from "@/features/workspace/server/anonymous-home-sections";
import { privateSessionJson } from "@/lib/api/internal-session-response";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  if (locals.demo)
    return privateSessionJson({
      notices: getDemoHomeInformation(locals.locale).notices,
    });
  return Response.json(
    await loadHomeNotices({
      locale: locals.locale,
      requestId: locals.requestId,
    }),
    {
      headers: {
        "Cache-Control": "public, max-age=0, no-store",
        "Cloudflare-CDN-Cache-Control": "no-store",
        Vary: "Accept-Language",
      },
    },
  );
};
