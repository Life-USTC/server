import {
  getCachedUserCalendarExport,
  requestMatchesEtag,
} from "@/features/calendar/server/calendar-export-cache";
import {
  getSectionForCalendar,
  getSectionsForCalendar,
  getUserCalendarRecord,
} from "@/features/calendar/server/calendar-export-data";
import { buildUserCalendarExport } from "@/features/calendar/server/calendar-export-service";
import {
  createMultiSectionCalendar,
  createSectionCalendar,
} from "@/features/calendar/server/ical";
import { handleRouteError, notFound } from "@/lib/api/helpers";
import {
  calendarNotModifiedResponse,
  calendarResponse,
} from "./calendar-route-utils";

export async function generateSectionsCalendarAction(sectionIds: number[]) {
  const sections = await getSectionsForCalendar(sectionIds);

  if (sections.length === 0) {
    return handleRouteError("No sections found", new Error("No sections"), 404);
  }

  const calendar = await createMultiSectionCalendar(sections);

  return calendarResponse(
    calendar.toString(),
    "life-ustc-schedule.ics",
    "public, max-age=3600",
  );
}

export async function generateSectionCalendarAction(sectionJwId: number) {
  const section = await getSectionForCalendar(sectionJwId);

  if (!section) {
    return notFound("Section not found");
  }

  const calendar = await createSectionCalendar(section);

  return calendarResponse(
    calendar.toString(),
    `life-ustc-${section.semesterId}-${section.code}.ics`,
    "public, max-age=3600",
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
