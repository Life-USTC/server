import { badRequest, parseInteger } from "@/lib/api/helpers";
import { parseDateInput } from "@/lib/time/parse-date-input";

export function parseOptionalDateQuery(
  name: string,
  value: string | undefined,
  message: string,
) {
  if (!value) return undefined;
  const parsed = parseDateInput(value);
  return parsed instanceof Date
    ? parsed
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
