import { json } from "@sveltejs/kit";
import { parseSectionJwId } from "@/features/section-detail/server/section-detail-params";
import { getSectionPersonalData } from "@/features/section-detail/server/section-personal-data";
import type { RequestHandler } from "./$types";

const headers = {
  "Cache-Control": "private, no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "Cookie",
};

export const GET: RequestHandler = async ({ locals, params, request, url }) => {
  if (request.headers.has("authorization"))
    return json(
      { error: "Session authentication required" },
      { status: 401, headers },
    );
  const jwId = parseSectionJwId(params.jwId);
  if (jwId === null)
    return json({ error: "Invalid section" }, { status: 400, headers });
  try {
    const data = await getSectionPersonalData({
      jwId,
      userId: locals.authUser?.id ?? null,
      focusedHomeworkId: url.searchParams.get("homeworkId"),
    });
    return data
      ? json(data, { headers })
      : json({ error: "Section not found" }, { status: 404, headers });
  } catch {
    return json(
      { error: "Failed to load section viewer" },
      { status: 500, headers },
    );
  }
};
