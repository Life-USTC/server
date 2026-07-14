import {
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { compactOverviewQuerySchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

export async function getMyCompactOverviewRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "dashboard", action: "read" },
  });
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedQuery = parseRouteSearchParams(
    new URL(request.url).searchParams,
    compactOverviewQuerySchema,
    "Invalid overview query",
    { logErrors: true },
  );
  if (parsedQuery instanceof Response) return parsedQuery;

  try {
    const { getCompactOverview } = await import(
      "@/features/dashboard/server/compact-overview-read-model"
    );
    const overview = await getCompactOverview(userId, {
      atTime: parsedQuery.atTime,
      homeworkWindowDays: parsedQuery.homeworkWindowDays ?? 7,
      limit: parsedQuery.limit ?? 3,
      locale: parsedQuery.locale ?? getRequestLocale(request),
    });

    return jsonResponse(overview);
  } catch (error) {
    return handleRouteError("Failed to fetch overview", error);
  }
}
