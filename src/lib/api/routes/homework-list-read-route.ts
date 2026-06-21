import { listSectionHomeworksWithAudit } from "@/features/homeworks/server/homework-list-read-model";
import {
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { parseHomeworkSectionIds } from "@/lib/api/routes/homework-route-helpers";
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

  const sectionIdList = parseHomeworkSectionIds(parsedQuery);
  if (sectionIdList instanceof Response) return sectionIdList;

  const includeDeleted = parsedQuery.includeDeleted === "true";

  try {
    const viewerUserId = await resolveApiUserId(request);
    const result = await listSectionHomeworksWithAudit({
      includeDeleted,
      sectionIds: sectionIdList,
      userId: viewerUserId,
    });

    return jsonResponse(result);
  } catch (error) {
    return handleRouteError("Failed to fetch homeworks", error);
  }
}
