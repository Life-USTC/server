import {
  getCachedUserCalendarExport,
  requestMatchesEtag,
} from "@/features/calendar/server/calendar-export-cache";
import { getUserCalendarRecord } from "@/features/calendar/server/calendar-export-data";
import { buildUserCalendarExport } from "@/features/calendar/server/calendar-export-service";
import {
  buildSectionCalendarExport,
  buildSectionsCalendarExport,
} from "@/features/calendar/server/calendar-section-export";
import { handleRouteError, notFound } from "@/lib/api/helpers";
import {
  calendarNotModifiedResponse,
  calendarResponse,
} from "./calendar-route-utils";

export async function generateSectionsCalendarAction(sectionIds: number[]) {
  const calendar = await buildSectionsCalendarExport(sectionIds);

  if (!calendar) {
    return handleRouteError("No sections found", new Error("No sections"), 404);
  }

  return calendarResponse(
    calendar.text,
    calendar.filename,
    calendar.cacheControl,
  );
}

export async function generateSectionCalendarAction(sectionJwId: number) {
  const calendar = await buildSectionCalendarExport(sectionJwId);

  if (!calendar) {
    return notFound("Section not found");
  }

  return calendarResponse(
    calendar.text,
    calendar.filename,
    calendar.cacheControl,
  );
}

export async function generateUserCalendarAction(
  userId: string,
  request: Request,
  defer?: (promise: Promise<unknown>) => void,
) {
  const { calendar } = await getCachedUserCalendarExport(
    userId,
    async () => {
      const user = await getUserCalendarRecord(userId);
      if (!user) return null;
      return buildUserCalendarExport(user, userId);
    },
    { defer },
  );
  if (!calendar) {
    return notFound("No calendar items found");
  }

  const etagHeaders = { ETag: calendar.etag };
  if (requestMatchesEtag(request, calendar.etag)) {
    return calendarNotModifiedResponse(calendar.cacheControl, etagHeaders);
  }

  return calendarResponse(
    calendar.text,
    calendar.filename,
    calendar.cacheControl,
    etagHeaders,
  );
}
