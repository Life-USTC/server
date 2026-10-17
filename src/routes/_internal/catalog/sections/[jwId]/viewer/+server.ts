import { parseSectionJwId } from "@/features/section-detail/server/section-detail-params";
import { getSectionPersonalData } from "@/features/section-detail/server/section-personal-data";
import {
  privateSessionJson,
  rejectBearerOnSessionRoute,
} from "@/lib/api/internal-session-response";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params, request, url }) => {
  const rejected = rejectBearerOnSessionRoute(request);
  if (rejected) return rejected;
  const jwId = parseSectionJwId(params.jwId);
  if (jwId === null)
    return privateSessionJson({ error: "Invalid section" }, { status: 400 });
  try {
    const data = await getSectionPersonalData({
      jwId,
      userId: locals.authUser?.id ?? null,
      focusedHomeworkId: url.searchParams.get("homeworkId"),
    });
    return data
      ? privateSessionJson(data)
      : privateSessionJson({ error: "Section not found" }, { status: 404 });
  } catch {
    return privateSessionJson(
      { error: "Failed to load section viewer" },
      { status: 500 },
    );
  }
};
