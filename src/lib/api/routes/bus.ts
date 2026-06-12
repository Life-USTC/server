import { handleRouteError, jsonResponse, notFound } from "@/lib/api/helpers";
import {
  parseBusPreferenceBody,
  parseBusRouteQuery,
} from "@/lib/api/routes/bus-route-request";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { busQueryResponseSchema } from "@/lib/api/schemas/response-schemas";
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
      "@/features/bus/lib/bus-service"
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

export async function getBusPreferencesRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    const { getBusPreference } = await import("@/features/bus/lib/bus-service");
    const preference = await getBusPreference(userId);
    return jsonResponse({ preference });
  } catch (error) {
    return handleRouteError("Failed to fetch bus preferences", error);
  }
}

export async function postBusPreferencesRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedBody = await parseBusPreferenceBody(request);
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  try {
    const { saveBusPreference } = await import(
      "@/features/bus/lib/bus-service"
    );
    const preference = await saveBusPreference(userId, parsedBody);
    return jsonResponse({ preference });
  } catch (error) {
    return handleRouteError("Failed to save bus preferences", error);
  }
}
