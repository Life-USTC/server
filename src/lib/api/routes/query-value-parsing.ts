import { badRequest, parseInteger } from "@/lib/api/helpers";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { startOfShanghaiDay } from "@/lib/time/shanghai-format";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateOnlyInput(value: string) {
  return DATE_ONLY_PATTERN.test(value.trim());
}

export function parseOptionalDateQuery(
  name: string,
  value: string | undefined,
  message: string,
  options: { dateOnlyAsShanghaiStart?: boolean } = {},
) {
  if (!value) return undefined;
  const parsed = parseDateInput(value);
  return parsed instanceof Date
    ? options.dateOnlyAsShanghaiStart && isDateOnlyInput(value)
      ? startOfShanghaiDay(parsed)
      : parsed
    : badRequest(`${message}: invalid ${name}`);
}

export function parsePositiveIntegerQuery(
  name: string,
  value: string | undefined,
  {
    defaultValue,
    max,
    message,
  }: {
    defaultValue?: number;
    max?: number;
    message: string;
  },
) {
  if (!value) return defaultValue;
  const parsed = parseInteger(value);
  if (parsed === null || parsed < 1 || (max !== undefined && parsed > max)) {
    return badRequest(`${message}: invalid ${name}`);
  }
  return parsed;
}
