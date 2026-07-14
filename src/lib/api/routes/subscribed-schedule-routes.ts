import {
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { subscribedSchedulesQuerySchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";
import { serializeScheduleTimeFields } from "@/shared/lib/schedule-serialization";

export async function getMySubscribedSchedulesRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "schedule", action: "read" },
  });
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedQuery = parseRouteSearchParams(
    new URL(request.url).searchParams,
    subscribedSchedulesQuerySchema,
    "Invalid subscribed schedules query",
    { logErrors: true },
  );
  if (parsedQuery instanceof Response) return parsedQuery;

  try {
    const { listSubscribedSchedules } = await import(
      "@/features/subscriptions/server/subscription-read-model"
    );
    const schedules = await listSubscribedSchedules(userId, {
      dateFrom: parsedQuery.dateFrom,
      dateTo: parsedQuery.dateTo,
      limit: parsedQuery.limit ?? 150,
      locale: parsedQuery.locale ?? getRequestLocale(request),
      weekday: parsedQuery.weekday,
    });

    return jsonResponse({
      schedules: schedules.map(serializeScheduleTimeFields),
    });
  } catch (error) {
    return handleRouteError("Failed to fetch subscribed schedules", error);
  }
}
