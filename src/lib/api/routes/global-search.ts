import { searchGlobally } from "@/features/search/server/global-search-service";
import { handleRouteError, jsonResponse } from "@/lib/api/helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { resolveApiUserId } from "@/lib/auth/api-auth";

const MAX_LIMIT = 10;

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

  try {
    const result = await searchGlobally({
      query: parsed.query,
      limit: parsed.limit,
      locale,
      userId,
    });
    return jsonResponse(result);
  } catch (error) {
    return handleRouteError("Failed to search", error);
  }
}
