import { parseRouteInput } from "@/lib/api/helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";

export type IdParams = { id: string };

export function parseIdParam(params: IdParams, label: string) {
  return parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    `Invalid ${label} ID`,
  );
}
