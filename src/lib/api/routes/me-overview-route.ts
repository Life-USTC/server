import {
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  parseOptionalDateQuery,
  parsePositiveIntegerQuery,
} from "@/lib/api/routes/query-value-parsing";
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

  const atTime = parseOptionalDateQuery(
    "atTime",
    parsedQuery.atTime,
    "Invalid overview query",
    { dateOnlyAsShanghaiStart: true },
  );
  if (atTime instanceof Response) return atTime;

  const homeworkWindowDays = parsePositiveIntegerQuery(
    "homeworkWindowDays",
    parsedQuery.homeworkWindowDays,
    {
      defaultValue: 7,
      max: 90,
      message: "Invalid overview query",
    },
  );
  if (homeworkWindowDays instanceof Response) return homeworkWindowDays;

  const limit = parsePositiveIntegerQuery("limit", parsedQuery.limit, {
    defaultValue: 3,
    max: 50,
    message: "Invalid overview query",
  });
  if (limit instanceof Response) return limit;

  try {
    const { getCompactOverview } = await import(
      "@/features/dashboard/server/compact-overview-read-model"
    );
    const overview = await getCompactOverview(userId, {
      atTime,
      homeworkWindowDays,
      limit,
      locale: parsedQuery.locale ?? getRequestLocale(request),
    });

    return jsonResponse(overview);
  } catch (error) {
    return handleRouteError("Failed to fetch overview", error);
  }
}
