import type { AppLocale } from "@/i18n/config";
import {
  jsonToolResult,
  resolveMcpMode,
  resolveSectionByJwId,
} from "@/lib/mcp/tools/_helpers";
import { summarizeScheduleCard } from "@/lib/mcp/tools/event-summary";
import {
  omitScheduleSection,
  parseScheduleDateFilter,
} from "./schedule-record-query";
import {
  sectionNotFoundToolResult,
  sectionScheduleListInclude,
} from "./shared";

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
  const { localizedPrisma, section } = await resolveSectionByJwId(
    sectionJwId,
    locale,
  );

  if (!section) {
    return sectionNotFoundToolResult(sectionJwId, mode);
  }

  const parsedDateFilter = parseScheduleDateFilter({ dateFrom, dateTo });
  if (!parsedDateFilter.ok) {
    return parsedDateFilter.result;
  }

  const schedules = await localizedPrisma.schedule.findMany({
    where: { sectionId: section.id, ...parsedDateFilter.dateFilter },
    include: sectionScheduleListInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: limit,
  });
  const scopedSchedules = omitScheduleSection(schedules);

  if (resolvedMode === "summary") {
    return jsonToolResult(
      {
        found: true,
        section,
        schedules: {
          total: schedules.length,
          items: scopedSchedules.slice(0, 5).map(summarizeScheduleCard),
        },
      },
      { mode: "default" },
    );
  }

  return jsonToolResult(
    {
      found: true,
      section,
      schedules: resolvedMode === "full" ? schedules : scopedSchedules,
    },
    {
      mode: resolvedMode,
    },
  );
}
