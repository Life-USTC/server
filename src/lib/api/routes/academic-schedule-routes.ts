import { listPublicSchedules } from "@/features/catalog/server/schedule-read-model";
import {
  handleRouteError,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { parseAcademicScheduleFilters } from "@/lib/api/routes/academic-schedule-query";
import { schedulesQuerySchema } from "@/lib/api/schemas/request-schemas";

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
    const filters = parseAcademicScheduleFilters(parsedQuery);
    if (filters instanceof Response) return filters;

    return jsonResponse(
      await listPublicSchedules({
        filters,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    );
  } catch (error) {
    return handleRouteError("Failed to fetch schedules", error);
  }
}
