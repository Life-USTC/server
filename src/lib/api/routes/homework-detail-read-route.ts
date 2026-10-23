import { getSectionHomeworkDetail } from "@/features/homeworks/server/homework-list-read-model";
import { handleRouteError, jsonResponse, notFound } from "@/lib/api/helpers";
import { parseHomeworkId } from "@/lib/api/routes/homework-route-helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { resolveOptionalApiUserId } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function getHomeworkDetailRoute(
  request: Request,
  params: IdParams,
) {
  const id = parseHomeworkId(params);
  if (id instanceof Response) return id;

  try {
    const viewerUserId = await resolveOptionalApiUserId(request, {
      feature: "community.section-homework",
      action: "read",
    });
    if (viewerUserId instanceof Response) return viewerUserId;
    const result = await getSectionHomeworkDetail({
      homeworkId: id,
      locale: getRequestLocale(request),
      userId: viewerUserId,
    });
    return result ? jsonResponse(result) : notFound("Homework not found");
  } catch (error) {
    return handleRouteError("Failed to fetch homework", error);
  }
}
