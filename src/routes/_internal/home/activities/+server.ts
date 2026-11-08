import { getDemoHomeInformation } from "@/features/demo/server/demo-home";
import { loadHomeActivities } from "@/features/workspace/server/anonymous-home-sections";
import { privateSessionJson } from "@/lib/api/internal-session-response";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  if (locals.demo)
    return privateSessionJson({
      activities: getDemoHomeInformation(locals.locale).activities,
    });
  return Response.json(
    await loadHomeActivities({
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
