import {
  buildPaginatedResponse,
  handleRouteError,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { formatScheduleTimeFields } from "@/lib/api/routes/academic-route-helpers";
import { buildAcademicScheduleWhere } from "@/lib/api/routes/academic-schedule-query";
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
    const whereClause = await buildAcademicScheduleWhere(parsedQuery);
    if (whereClause instanceof Response) return whereClause;

    const [{ getPrisma, prisma }, { publicScheduleInclude }] =
      await Promise.all([
        import("@/lib/db/prisma"),
        import("@/lib/schedule-queries"),
      ]);

    const localizedPrisma = getPrisma("zh-cn");
    const [schedules, total] = await Promise.all([
      localizedPrisma.schedule.findMany({
        where: whereClause,
        skip: pagination.skip,
        take: pagination.pageSize,
        include: publicScheduleInclude,
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
      prisma.schedule.count({ where: whereClause }),
    ]);

    return jsonResponse(
      buildPaginatedResponse(
        schedules.map(formatScheduleTimeFields),
        pagination.page,
        pagination.pageSize,
        total,
      ),
    );
  } catch (error) {
    return handleRouteError("Failed to fetch schedules", error);
  }
}
