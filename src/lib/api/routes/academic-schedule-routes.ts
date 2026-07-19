import type { ScheduleListFilters } from "@/features/catalog/lib/schedule-filters";
import { listPublicSchedules } from "@/features/catalog/server/schedule-read-model";
import {
  handleRouteError,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { resolvePublicCatalogLocale } from "@/lib/api/routes/request-locale";
import { schedulesQuerySchema } from "@/lib/api/schemas/request-schemas";

export async function getSchedulesRoute(request: Request) {
  try {
    const localeResolution = resolvePublicCatalogLocale(request);
    if (localeResolution instanceof Response) {
      return localeResolution;
    }

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
        locale: localeResolution.locale,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
      { headers: localeResolution.cacheHeaders },
    );
  } catch (error) {
    return handleRouteError("Failed to fetch schedules", error);
  }
}
