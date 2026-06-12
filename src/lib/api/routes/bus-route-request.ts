import { parseRouteJsonBody, parseRouteSearchParams } from "@/lib/api/helpers";
import {
  busPreferenceRequestSchema,
  busQuerySchema,
} from "@/lib/api/schemas/request-schemas";

export function parseBusRouteQuery(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  return parseRouteSearchParams(
    searchParams,
    busQuerySchema,
    "Invalid bus query",
    { logErrors: true },
  );
}

export function parseBusPreferenceBody(request: Request) {
  return parseRouteJsonBody(
    request,
    busPreferenceRequestSchema,
    "Invalid bus preference request",
  );
}
