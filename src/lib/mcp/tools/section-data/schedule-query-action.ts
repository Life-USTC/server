import { listPublicSchedules } from "@/features/catalog/server/schedule-read-model";
import type { AppLocale } from "@/i18n/config";
import {
  jsonToolResult,
  parseMcpDateRange,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

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
  const dateRange = parseMcpDateRange({ dateFrom, dateTo });
  if (!dateRange.ok) {
    return dateRange.result;
  }
  const result = await listPublicSchedules({
    filters: {
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
    },
    locale,
    page: page ?? 1,
    pageSize: limit,
  });

  return jsonToolResult(result, {
    mode: resolveMcpMode(mode),
  });
}
