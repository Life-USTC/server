import { InvalidCalendarRangeError } from "@/features/calendar/server/personal-calendar-range";
import { readDemoCalendarEvents } from "@/features/demo/server/demo-calendar-events";
import type { AppLocale } from "@/i18n/config";
import { parseRouteSearchParams } from "@/lib/api/helpers";
import { errorResponse, schemaJsonResponse } from "@/lib/api/responses";
import {
  personalCalendarPageSchema,
  personalCalendarQuerySchema,
} from "@/lib/api/schemas/young-workspace-schemas";

/** Called only after the request boundary verifies a live demo session. */
export function getDemoCalendarRoute(request: Request, locale: AppLocale) {
  const query = parseRouteSearchParams(
    new URL(request.url).searchParams,
    personalCalendarQuerySchema.strict(),
    "Invalid calendar query",
  );
  if (query instanceof Response) return query;
  try {
    return schemaJsonResponse(
      personalCalendarPageSchema,
      readDemoCalendarEvents(locale, query),
    );
  } catch (error) {
    if (error instanceof InvalidCalendarRangeError)
      return errorResponse(error.message, 400);
    throw error;
  }
}
