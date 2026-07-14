import type { ScheduleListFilters } from "@/features/catalog/lib/schedule-filters";
import { listPublicSchedules } from "@/features/catalog/server/schedule-read-model";
import {
  handleRouteError,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { schedulesQuerySchema } from "@/lib/api/schemas/request-schemas";
import { PUBLIC_LOCALE_CATALOG_HEADERS } from "@/lib/public-cache-control";

export async function getSchedulesRoute(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsed = parseRouteQuery(
      searchParams,
      schedulesQuerySchema,
      "Invalid schedule query",
      { logErrors: true },
    );
    if (parsed instanceof Response) {
      return parsed;
    }

    const { query: parsedQuery, pagination } = parsed;
    const filters = {
      sectionId: parsedQuery.sectionId,
      sectionJwId: parsedQuery.sectionJwId,
      sectionCode: parsedQuery.sectionCode,
      teacherId: parsedQuery.teacherId,
      teacherCode: parsedQuery.teacherCode,
      roomId: parsedQuery.roomId,
      roomJwId: parsedQuery.roomJwId,
      dateFrom: parsedQuery.dateFrom,
      dateTo: parsedQuery.dateTo,
      weekday: parsedQuery.weekday,
    } satisfies ScheduleListFilters;

    return jsonResponse(
      await listPublicSchedules({
        filters,
        locale: getRequestLocale(request),
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
      { headers: PUBLIC_LOCALE_CATALOG_HEADERS },
    );
  } catch (error) {
    return handleRouteError("Failed to fetch schedules", error);
  }
}
