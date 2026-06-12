import type { AppLocale } from "@/i18n/config";
import { buildPaginatedResponse, normalizePagination } from "@/lib/api/helpers";
import { getPrisma } from "@/lib/db/prisma";
import {
  jsonToolResult,
  parseMcpDateRange,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import {
  buildScheduleListWhere,
  publicScheduleInclude,
} from "@/lib/schedule-queries";

type McpModeInput = Parameters<typeof resolveMcpMode>[0];

type QuerySchedulesInput = {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  locale: AppLocale;
  mode?: McpModeInput;
  page?: number;
  roomId?: number;
  roomJwId?: number;
  sectionCode?: string;
  sectionId?: number;
  sectionJwId?: number;
  teacherCode?: string;
  teacherId?: number;
  weekday?: number;
};

export async function querySchedulesAction({
  sectionId,
  sectionJwId,
  sectionCode,
  teacherId,
  teacherCode,
  roomId,
  roomJwId,
  weekday,
  dateFrom,
  dateTo,
  page,
  limit,
  locale,
  mode,
}: QuerySchedulesInput) {
  const localizedPrisma = getPrisma(locale);
  const pagination = normalizePagination({ page, pageSize: limit });
  const dateRange = parseMcpDateRange({ dateFrom, dateTo });
  if (!dateRange.ok) {
    return dateRange.result;
  }
  const where = buildScheduleListWhere({
    sectionId,
    sectionJwId,
    sectionCode,
    teacherId,
    teacherCode,
    roomId,
    roomJwId,
    weekday,
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
  });

  const [schedules, total] = await Promise.all([
    localizedPrisma.schedule.findMany({
      where,
      skip: pagination.skip,
      take: pagination.pageSize,
      include: publicScheduleInclude,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    localizedPrisma.schedule.count({ where }),
  ]);

  return jsonToolResult(
    buildPaginatedResponse(
      schedules,
      pagination.page,
      pagination.pageSize,
      total,
    ),
    {
      mode: resolveMcpMode(mode),
    },
  );
}
