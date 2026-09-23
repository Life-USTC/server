import { getWeatherSnapshot } from "@/features/weather/server/weather-service";
import {
  errorResponse,
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { weatherQuerySchema } from "@/lib/api/schemas/weather-schemas";
import { PRIVATE_LOCALE_CATALOG_HEADERS } from "@/lib/public-cache-control";

export async function getWeatherRoute(request: Request) {
  const parsedQuery = parseRouteSearchParams(
    new URL(request.url).searchParams,
    weatherQuerySchema,
    "Invalid weather query",
    { logErrors: true },
  );
  if (parsedQuery instanceof Response) return parsedQuery;

  try {
    const snapshot = await getWeatherSnapshot(parsedQuery.locationKey);
    if (!snapshot) {
      return errorResponse("Weather data is unavailable", 503);
    }
    return jsonResponse(snapshot, { headers: PRIVATE_LOCALE_CATALOG_HEADERS });
  } catch (error) {
    return handleRouteError("Failed to fetch weather", error);
  }
}
