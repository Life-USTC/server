import { parseRequiredDateInput } from "@/lib/time/date-time-from-hhmm";
import { parseDateInput } from "@/lib/time/parse-date-input";
import {
  formatShanghaiDate,
  startOfShanghaiDay,
} from "@/lib/time/shanghai-format";
import { jsonToolResult } from "./helper-results";

const MCP_DATE_FILTER_USAGE = "Use YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS+08:00.";

const DATE_ONLY_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type McpDateParseFailure = {
  ok: false;
  result: ReturnType<typeof jsonToolResult>;
};

export type OptionalFieldDateParseResult =
  | {
      ok: true;
      value: Date | null | undefined;
    }
  | McpDateParseFailure;

export type OptionalMcpDateParseOptions = {
  dateOnlyAsShanghaiStart?: boolean;
};

export type OptionalMcpDate =
  | {
      ok: true;
      value?: Date;
      dateOnly: boolean;
    }
  | McpDateParseFailure;

export type McpDateRangeInput = {
  dateFrom?: string;
  dateTo?: string;
};

export type McpDateRange =
  | {
      ok: true;
      dateFrom?: Date;
      dateTo?: Date;
      dateFromIsDateOnly: boolean;
      dateToIsDateOnly: boolean;
    }
  | McpDateParseFailure;

export function getTodayBounds(atTime?: Date) {
  const now = atTime ?? new Date();
  const todayStart = parseRequiredDateInput(formatShanghaiDate(now));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  return { now, todayStart, tomorrowStart };
}

export function parseOptionalMcpDate(
  name: string,
  value?: string,
  options: OptionalMcpDateParseOptions = {},
): OptionalMcpDate {
  if (!value) {
    return { ok: true, dateOnly: false };
  }

  const parsed = parseDateInput(value);
  if (!(parsed instanceof Date)) {
    return {
      ok: false,
      result: jsonToolResult({
        success: false,
        message: `Invalid ${name}: "${value}". ${MCP_DATE_FILTER_USAGE}`,
      }),
    };
  }

  const dateOnly = DATE_ONLY_INPUT_PATTERN.test(value.trim());
  return {
    ok: true,
    value:
      dateOnly && options.dateOnlyAsShanghaiStart
        ? startOfShanghaiDay(parsed)
        : parsed,
    dateOnly,
  };
}

export function parseOptionalFieldDate(
  fieldName: string,
  value: string | null | undefined,
  shouldParse = true,
): OptionalFieldDateParseResult {
  if (!shouldParse) {
    return { ok: true, value: undefined };
  }
  if (value === null) {
    return { ok: true, value: null };
  }

  const parsed = parseOptionalMcpDate(fieldName, value);
  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, value: parsed.value ?? null };
}

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
