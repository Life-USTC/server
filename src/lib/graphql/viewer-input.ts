import { GraphQLError } from "graphql";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";

function badDateInput(message: string): never {
  throw new GraphQLError(message, {
    extensions: { code: "BAD_USER_INPUT" },
  });
}

/**
 * Converts a DateTime scalar value into the UTC-midnight representation used
 * by Prisma `@db.Date` fields, based on its Asia/Shanghai calendar day.
 */
export function parseGraphqlDateTimeInstant(value: string, field: string) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    badDateInput(`${field} must be a valid DateTime.`);
  }
  return instant;
}

export function normalizeGraphqlShanghaiCalendarDate(
  value: string,
  field: string,
) {
  const instant = parseGraphqlDateTimeInstant(value, field);
  const normalized = parseDateInput(formatShanghaiDate(instant));
  if (!(normalized instanceof Date)) {
    badDateInput(`${field} could not be normalized.`);
  }
  return normalized;
}

export function validateGraphqlDateRange(
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
) {
  if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
    badDateInput("dateFrom must not be after dateTo.");
  }
}
