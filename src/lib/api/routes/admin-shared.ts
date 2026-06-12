import { parseRouteInput } from "@/lib/api/helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";
import { parseDateInput } from "@/lib/time/parse-date-input";

export type IdParams = { id: string };

export function ilike(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

export function parseIdParam(params: IdParams, label: string) {
  return parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    `Invalid ${label} ID`,
  );
}

export function parseDate(value: string | null) {
  const parsed = parseDateInput(value);
  return parsed instanceof Date ? parsed : null;
}
