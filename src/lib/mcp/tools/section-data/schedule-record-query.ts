import { parseMcpDateRange } from "@/lib/mcp/tools/_helpers";

export function parseScheduleDateFilter(input: {
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  const dateRange = parseMcpDateRange({
    dateFrom: input.dateFrom ?? undefined,
    dateTo: input.dateTo ?? undefined,
  });
  if (!dateRange.ok) return dateRange;

  return {
    ok: true as const,
    dateFilter:
      dateRange.dateFrom || dateRange.dateTo
        ? {
            date: {
              ...(dateRange.dateFrom ? { gte: dateRange.dateFrom } : {}),
              ...(dateRange.dateTo ? { lte: dateRange.dateTo } : {}),
            },
          }
        : {},
    dateRange,
  };
}

export function omitScheduleSection<T extends { section?: unknown }>(
  schedules: T[],
) {
  return schedules.map(({ section: _section, ...schedule }) => schedule);
}
