import type { NextRequest } from "next/server";
import {
  buildPaginatedResponse,
  handleRouteError,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { schedulesQuerySchema } from "@/lib/api/schemas/request-schemas";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import {
  buildScheduleListWhere,
  publicScheduleInclude,
} from "@/lib/schedule-queries";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { formatTime } from "@/shared/lib/time-utils";
export const dynamic = "force-dynamic";

function parseScheduleDateParam(name: "dateFrom" | "dateTo", value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = parseDateInput(value);
  return parsed instanceof Date
    ? parsed
    : handleRouteError("Invalid schedule query", `Invalid ${name}`, 400);
}

/**
 * List schedules with filters and pagination.
 * @params schedulesQuerySchema
 * @response paginatedScheduleResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
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
    const {
      sectionId,
      sectionJwId,
      sectionCode,
      teacherId,
      teacherCode,
      roomId,
      roomJwId,
      dateFrom,
      dateTo,
      weekday,
    } = parsedQuery;

    const parsedDateFrom = parseScheduleDateParam("dateFrom", dateFrom);
    if (parsedDateFrom instanceof Response) {
      return parsedDateFrom;
    }
    const parsedDateTo = parseScheduleDateParam("dateTo", dateTo);
    if (parsedDateTo instanceof Response) {
      return parsedDateTo;
    }
    const whereClause = buildScheduleListWhere({
      sectionId,
      sectionJwId,
      sectionCode,
      teacherId,
      teacherCode,
      roomId,
      roomJwId,
      weekday,
      dateFrom: parsedDateFrom,
      dateTo: parsedDateTo,
    });

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
        schedules.map((schedule: (typeof schedules)[number]) => ({
          ...schedule,
          startTime: formatTime(schedule.startTime),
          endTime: formatTime(schedule.endTime),
        })),
        pagination.page,
        pagination.pageSize,
        total,
      ),
    );
  } catch (error) {
    return handleRouteError("Failed to fetch schedules", error);
  }
}
export const GET = observedApiRoute(getRoute);
