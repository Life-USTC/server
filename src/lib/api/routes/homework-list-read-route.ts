import { listSectionHomeworksWithAudit } from "@/features/homeworks/server/homework-list-read-model";
import {
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { resolveHomeworkRouteSectionIds } from "@/lib/api/routes/homework-route-helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { homeworksQuerySchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/api-auth";

export async function getHomeworksRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedQuery = parseRouteSearchParams(
    searchParams,
    homeworksQuerySchema,
    "Invalid homework query",
    { logErrors: true },
  );
  if (parsedQuery instanceof Response) {
    return parsedQuery;
  }

  const includeDeleted = parsedQuery.includeDeleted === "true";

  try {
    const sectionIdList = await resolveHomeworkRouteSectionIds(parsedQuery);
    if (sectionIdList instanceof Response) return sectionIdList;

    const viewerUserId = await resolveApiUserId(request);
    const result = await listSectionHomeworksWithAudit({
      includeDeleted,
      locale: getRequestLocale(request),
      sectionIds: sectionIdList,
      userId: viewerUserId,
    });

    return jsonResponse(result);
  } catch (error) {
    return handleRouteError("Failed to fetch homeworks", error);
  }
}
