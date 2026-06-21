import { getSectionSchedulesByJwId } from "@/features/catalog/server/schedule-read-model";
import type { AppLocale } from "@/i18n/config";
import { jsonToolResult, resolveMcpMode } from "@/lib/mcp/tools/_helpers";
import { summarizeScheduleCard } from "@/lib/mcp/tools/event-summary";
import {
  omitScheduleSection,
  parseScheduleDateFilter,
} from "./schedule-record-query";
import { sectionNotFoundToolResult } from "./shared";

type McpModeInput = Parameters<typeof resolveMcpMode>[0];

type ListSchedulesBySectionInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  locale: AppLocale;
  mode?: McpModeInput;
  sectionJwId: number;
};

export async function listSchedulesBySectionAction({
  sectionJwId,
  dateFrom,
  dateTo,
  limit,
  locale,
  mode,
}: ListSchedulesBySectionInput) {
  const resolvedMode = resolveMcpMode(mode);
  const parsedDateFilter = parseScheduleDateFilter({ dateFrom, dateTo });
  if (!parsedDateFilter.ok) {
    return parsedDateFilter.result;
  }

  const result = await getSectionSchedulesByJwId({
    dateFrom: parsedDateFilter.dateRange.dateFrom,
    dateTo: parsedDateFilter.dateRange.dateTo,
    includeSection: true,
    limit,
    locale,
    sectionJwId,
  });

  if (!result.found) {
    return sectionNotFoundToolResult(sectionJwId, mode);
  }

  const scopedSchedules = omitScheduleSection(result.schedules);

  if (resolvedMode === "summary") {
    return jsonToolResult(
      {
        found: true,
        section: result.section,
        schedules: {
          total: result.schedules.length,
          items: scopedSchedules.slice(0, 5).map(summarizeScheduleCard),
        },
      },
      { mode: "default" },
    );
  }

  return jsonToolResult(
    {
      found: true,
      section: result.section,
      schedules: resolvedMode === "full" ? result.schedules : scopedSchedules,
    },
    {
      mode: resolvedMode,
    },
  );
}
