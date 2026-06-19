import { parseRouteInput } from "@/lib/api/helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";

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
