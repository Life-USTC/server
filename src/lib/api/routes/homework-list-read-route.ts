import {
  HOMEWORK_LIST_DEFAULT_PAGE_SIZE,
  HOMEWORK_LIST_MAX_PAGE_SIZE,
} from "@/features/homeworks/lib/homework-list-bounds";
import { listSectionHomeworkPageWithAudit } from "@/features/homeworks/server/homework-list-read-model";
import {
  getRequestSearchParams,
  handleRouteError,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { resolveHomeworkRouteSectionIds } from "@/lib/api/routes/homework-route-helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { homeworksQuerySchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/api-auth";

export async function getHomeworksRoute(request: Request) {
  const parsed = parseRouteQuery(
    getRequestSearchParams(request),
    homeworksQuerySchema,
    "Invalid homework query",
    {
      logErrors: true,
      pagination: {
        defaultPageSize: HOMEWORK_LIST_DEFAULT_PAGE_SIZE,
        maxPageSize: HOMEWORK_LIST_MAX_PAGE_SIZE,
        pageSizeAliasParam: "pageSize",
      },
    },
  );
  if (parsed instanceof Response) {
    return parsed;
  }

  try {
    const { includeDeleted, sectionId, sectionIds, sectionJwId } = parsed.query;
    const sectionIdList = await resolveHomeworkRouteSectionIds({
      sectionId,
      sectionIds,
      sectionJwId,
    });
    if (sectionIdList instanceof Response) return sectionIdList;

    const viewerUserId = await resolveApiUserId(request);
    const result = await listSectionHomeworkPageWithAudit({
      includeDeleted: includeDeleted ?? false,
      locale: getRequestLocale(request),
      pagination: parsed.pagination,
      sectionIds: sectionIdList,
      userId: viewerUserId,
    });

    return jsonResponse(result);
  } catch (error) {
    return handleRouteError("Failed to fetch homeworks", error);
  }
}
