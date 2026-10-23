import { handleRouteError, parseRouteSearchParams } from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { subscribedSchedulesQuerySchema } from "@/lib/api/schemas/request-schemas";
import { subscribedSchedulesResponseSchema } from "@/lib/api/schemas/schedule-response-schema-core";
import { requireAuth } from "@/lib/auth/api-auth";

export async function getMySubscribedSchedulesRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.schedule", action: "read" },
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
    const { listSubscribedSchedules, toSubscribedScheduleEntryDto } =
      await import("@/features/subscriptions/server/subscription-read-model");
    const locale = parsedQuery.locale ?? getRequestLocale(request);
    const schedules = await listSubscribedSchedules(userId, {
      dateFrom: parsedQuery.dateFrom,
      dateTo: parsedQuery.dateTo,
      limit: parsedQuery.limit ?? 150,
      locale,
      weekday: parsedQuery.weekday,
    });

    return schemaJsonResponse(subscribedSchedulesResponseSchema, {
      schedules: schedules.map((schedule) =>
        toSubscribedScheduleEntryDto(schedule, locale),
      ),
    });
  } catch (error) {
    return handleRouteError("Failed to fetch subscribed schedules", error);
  }
}
