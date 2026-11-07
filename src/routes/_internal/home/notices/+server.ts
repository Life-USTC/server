import { loadHomeNotices } from "@/features/workspace/server/anonymous-home-sections";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) =>
  Response.json(
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
