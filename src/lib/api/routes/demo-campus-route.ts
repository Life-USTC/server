import type { z } from "zod";
import {
  getDemoBusNext,
  getDemoBusRoutes,
  getDemoBusTimetable,
} from "@/features/demo/server/demo-bus";
import { getDemoWeatherSnapshot } from "@/features/demo/server/demo-weather";
import type { AppLocale } from "@/i18n/config";
import { parseRouteSearchParams } from "@/lib/api/helpers";
import { errorResponse, schemaJsonResponse } from "@/lib/api/responses";
import {
  busNextDeparturesQuerySchema,
  busQuerySchema,
  busRouteSearchQuerySchema,
  weatherQuerySchema,
} from "@/lib/api/schemas/request-schemas";
import {
  busNextDeparturesResponseSchema,
  busQueryResponseSchema,
  busRouteSearchResponseSchema,
  weatherSnapshotResponseSchema,
} from "@/lib/api/schemas/response-schemas";

function query<T extends z.ZodObject>(request: Request, schema: T) {
  const params = new URL(request.url).searchParams;
  if (
    [...new Set(params.keys())].some((key) => params.getAll(key).length !== 1)
  )
    return errorResponse("Duplicate demo query", 400);
  return parseRouteSearchParams(params, schema, "Invalid demo campus query");
}

/** Trusted Demo boundary has already rejected expired/mixed identities and writes. */
export function getDemoWeatherRoute(request: Request, locale: AppLocale) {
  const parsed = query(request, weatherQuerySchema.strict());
  if (parsed instanceof Response) return parsed;
  return schemaJsonResponse(
    weatherSnapshotResponseSchema,
    getDemoWeatherSnapshot(parsed.locationKey, locale),
  );
}

export function getDemoBusRoute(request: Request, locale: AppLocale) {
  const parsed = query(request, busQuerySchema.strict());
  if (parsed instanceof Response) return parsed;
  const data = getDemoBusTimetable(locale, parsed.versionKey);
  return data
    ? schemaJsonResponse(busQueryResponseSchema, data)
    : errorResponse("Demo timetable not found", 404);
}

export function getDemoBusRoutesRoute(request: Request, locale: AppLocale) {
  const parsed = query(request, busRouteSearchQuerySchema.strict());
  if (parsed instanceof Response) return parsed;
  const data = getDemoBusRoutes(parsed.locale ?? locale, parsed);
  return data
    ? schemaJsonResponse(busRouteSearchResponseSchema, data)
    : errorResponse("Demo route target not found", 404);
}

export function getDemoBusNextRoute(request: Request, locale: AppLocale) {
  const parsed = query(request, busNextDeparturesQuerySchema.strict());
  if (parsed instanceof Response) return parsed;
  const data = getDemoBusNext(parsed.locale ?? locale, {
    ...parsed,
    atTime: parsed.atTime?.toISOString(),
  });
  return data
    ? schemaJsonResponse(busNextDeparturesResponseSchema, data)
    : errorResponse("Demo departure target or time not found", 404);
}
