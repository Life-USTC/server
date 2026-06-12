import type { McpDateRange, McpDateRangeInput } from "./helper-date-types";
import { parseOptionalMcpDate } from "./helper-optional-date-parsing";

export function parseMcpDateRange({
  dateFrom,
  dateTo,
}: McpDateRangeInput): McpDateRange {
  const parsedDateFrom = parseOptionalMcpDate("dateFrom", dateFrom);
  if (!parsedDateFrom.ok) {
    return parsedDateFrom;
  }

  const parsedDateTo = parseOptionalMcpDate("dateTo", dateTo);
  if (!parsedDateTo.ok) {
    return parsedDateTo;
  }

  return {
    ok: true,
    dateFrom: parsedDateFrom.value,
    dateTo: parsedDateTo.value,
    dateFromIsDateOnly: parsedDateFrom.dateOnly,
    dateToIsDateOnly: parsedDateTo.dateOnly,
  };
}
