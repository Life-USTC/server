import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  parseBusPreferenceBody,
  parseBusRouteQuery,
} from "@/lib/api/routes/bus-route-request";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import {
  busNextDeparturesQuerySchema,
  busRouteSearchQuerySchema,
} from "@/lib/api/schemas/request-schemas";
import {
  busNextDeparturesResponseSchema,
  busQueryResponseSchema,
  busRouteSearchResponseSchema,
} from "@/lib/api/schemas/response-schemas";
import { requireAuth, resolveApiUserId } from "@/lib/auth/api-auth";

export async function getBusRoute(request: Request) {
  const parsedQuery = parseBusRouteQuery(request);
  if (parsedQuery instanceof Response) {
    return parsedQuery;
  }

  const locale = getRequestLocale(request);
  const userId = await resolveApiUserId(request);

  try {
    const { getBusTimetableData } = await import(
      "@/features/bus/server/bus-service"
    );
    const result = await getBusTimetableData({
      locale: locale === "en-us" ? "en-us" : "zh-cn",
      versionKey: parsedQuery.versionKey ?? null,
      userId,
    });

    if (!result) {
      return notFound("Bus schedule is not available");
    }

    const validated = busQueryResponseSchema.parse(result);
    return jsonResponse(validated);
  } catch (error) {
    return handleRouteError("Failed to query shuttle bus schedules", error);
  }
}

export async function getBusRoutesSearchRoute(request: Request) {
  const parsedQuery = parseRouteSearchParams(
    new URL(request.url).searchParams,
    busRouteSearchQuerySchema,
    "Invalid bus route search query",
    { logErrors: true },
  );
  if (parsedQuery instanceof Response) return parsedQuery;

  try {
    const { searchBusRoutes } = await import(
      "@/features/bus/server/bus-service"
    );
    const result = await searchBusRoutes({
      destinationCampusId: parsedQuery.destinationCampusId,
      locale: parsedQuery.locale ?? getRequestLocale(request),
      originCampusId: parsedQuery.originCampusId,
      versionKey: parsedQuery.versionKey ?? null,
    });

    if (!result) {
      return notFound("Bus schedule is not available");
    }

    return jsonResponse(busRouteSearchResponseSchema.parse(result));
  } catch (error) {
    return handleRouteError("Failed to search shuttle bus routes", error);
  }
}

export async function getBusNextDeparturesRoute(request: Request) {
  const parsedQuery = parseRouteSearchParams(
    new URL(request.url).searchParams,
    busNextDeparturesQuerySchema,
    "Invalid bus next-departures query",
    { logErrors: true },
  );
  if (parsedQuery instanceof Response) return parsedQuery;

  try {
    const { getNextBusDepartures } = await import(
      "@/features/bus/server/bus-service"
    );
    const result = await getNextBusDepartures({
      atTime: parsedQuery.atTime?.toISOString(),
      dayType: parsedQuery.dayType ?? "auto",
      destinationCampusId: parsedQuery.destinationCampusId,
      includeDeparted: parsedQuery.includeDeparted ?? false,
      limit: parsedQuery.limit ?? 5,
      locale: parsedQuery.locale ?? getRequestLocale(request),
      originCampusId: parsedQuery.originCampusId,
      userId: await resolveApiUserId(request),
      versionKey: parsedQuery.versionKey ?? null,
    });

    if (!result) {
      return notFound("Bus schedule is not available");
    }

    return jsonResponse(busNextDeparturesResponseSchema.parse(result));
  } catch (error) {
    return handleRouteError("Failed to fetch next shuttle buses", error);
  }
}

export async function getBusPreferencesRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "bus", action: "read" },
  });
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    const { getBusPreference } = await import(
      "@/features/bus/server/bus-service"
    );
    const preference = await getBusPreference(userId);
    return jsonResponse({ preference });
  } catch (error) {
    return handleRouteError("Failed to fetch bus preferences", error);
  }
}

export async function postBusPreferencesRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "bus", action: "write" },
  });
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedBody = await parseBusPreferenceBody(request);
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  try {
    const { saveBusPreference } = await import(
      "@/features/bus/server/bus-service"
    );
    const result = await saveBusPreference(userId, parsedBody);
    if (!result.ok) {
      return badRequest(result.error);
    }
    return jsonResponse({ preference: result.preference });
  } catch (error) {
    return handleRouteError("Failed to save bus preferences", error);
  }
}
