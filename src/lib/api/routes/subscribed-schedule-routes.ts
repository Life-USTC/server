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
import { subscribedSchedulesQuerySchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";
import { serializeScheduleTimeFields } from "@/lib/schedule-serialization";

export async function getMySubscribedSchedulesRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedQuery = parseRouteSearchParams(
    new URL(request.url).searchParams,
    subscribedSchedulesQuerySchema,
    "Invalid subscribed schedules query",
    { logErrors: true },
  );
  if (parsedQuery instanceof Response) return parsedQuery;

  const dateFrom = parseOptionalDateQuery(
    "dateFrom",
    parsedQuery.dateFrom,
    "Invalid subscribed schedules query",
  );
  if (dateFrom instanceof Response) return dateFrom;

  const dateTo = parseOptionalDateQuery(
    "dateTo",
    parsedQuery.dateTo,
    "Invalid subscribed schedules query",
  );
  if (dateTo instanceof Response) return dateTo;

  const weekday = parsePositiveIntegerQuery("weekday", parsedQuery.weekday, {
    max: 7,
    message: "Invalid subscribed schedules query",
  });
  if (weekday instanceof Response) return weekday;

  const limit = parsePositiveIntegerQuery("limit", parsedQuery.limit, {
    defaultValue: 150,
    max: 300,
    message: "Invalid subscribed schedules query",
  });
  if (limit instanceof Response) return limit;

  try {
    const { listSubscribedSchedules } = await import(
      "@/features/home/server/subscription-read-model"
    );
    const schedules = await listSubscribedSchedules(userId, {
      dateFrom,
      dateTo,
      limit,
      locale: parsedQuery.locale ?? getRequestLocale(request),
      weekday,
    });

    return jsonResponse({
      schedules: schedules.map(serializeScheduleTimeFields),
    });
  } catch (error) {
    return handleRouteError("Failed to fetch subscribed schedules", error);
  }
}
