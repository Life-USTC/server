import { searchGlobally } from "@/features/search/server/global-search-service";
import { handleRouteError, jsonResponse } from "@/lib/api/helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { resolveApiUserId } from "@/lib/auth/api-auth";
import {
  PRIVATE_LOCALE_CATALOG_HEADERS,
  PUBLIC_SEARCH_CACHE_HEADERS,
} from "@/lib/public-cache-control";

const MAX_LIMIT = 25;

function parseSearchQuery(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("q") ?? searchParams.get("query") ?? "";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  if (
    limit !== undefined &&
    (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT)
  ) {
    return jsonResponse({ error: "Invalid limit" }, { status: 400 });
  }
  return { query, limit };
}

export async function getGlobalSearchRoute(request: Request) {
  const parsed = parseSearchQuery(request);
  if (parsed instanceof Response) return parsed;

  const locale = getRequestLocale(request);
  const userId = await resolveApiUserId(request);
  const origin = new URL(request.url).origin;

  try {
    const result = await searchGlobally({
      query: parsed.query,
      limit: parsed.limit,
      locale,
      origin,
      userId,
    });
    return jsonResponse(result, {
      headers: userId
        ? PRIVATE_LOCALE_CATALOG_HEADERS
        : PUBLIC_SEARCH_CACHE_HEADERS,
    });
  } catch (error) {
    return handleRouteError("Failed to search", error);
  }
}
