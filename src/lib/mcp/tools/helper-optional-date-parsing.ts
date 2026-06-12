import { parseDateInput } from "@/lib/time/parse-date-input";
import { startOfShanghaiDay } from "@/lib/time/shanghai-format";
import {
  isDateOnlyInput,
  MCP_DATE_FILTER_USAGE,
} from "./helper-date-constants";
import type {
  OptionalFieldDateParseResult,
  OptionalMcpDate,
  OptionalMcpDateParseOptions,
} from "./helper-date-types";
import { jsonToolResult } from "./helper-results";

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

  const dateOnly = isDateOnlyInput(value);
  return {
    ok: true,
    value:
      dateOnly && options.dateOnlyAsShanghaiStart
        ? startOfShanghaiDay(parsed)
        : parsed,
    dateOnly,
  };
}
