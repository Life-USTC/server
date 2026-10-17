/** Public (anonymous) section calendar exports shared by REST transports. */
import {
  getSectionForCalendar,
  getSectionsForCalendar,
} from "@/features/calendar/server/calendar-export-data";
import {
  createMultiSectionCalendar,
  createSectionCalendar,
} from "@/features/calendar/server/ical";

/** Public section calendars are edge-cacheable for one hour. */
export const PUBLIC_SECTION_CALENDAR_CACHE_CONTROL = "public, max-age=3600";

export type SectionCalendarExport = {
  cacheControl: string;
  filename: string;
  text: string;
};

export async function buildSectionsCalendarExport(
  sectionIds: number[],
): Promise<SectionCalendarExport | null> {
  const sections = await getSectionsForCalendar(sectionIds);
  if (sections.length === 0) return null;

  const calendar = await createMultiSectionCalendar(sections);
  return {
    cacheControl: PUBLIC_SECTION_CALENDAR_CACHE_CONTROL,
    filename: "life-ustc-schedule.ics",
    text: calendar.toString(),
  };
}

export async function buildSectionCalendarExport(
  sectionJwId: number,
): Promise<SectionCalendarExport | null> {
  const section = await getSectionForCalendar(sectionJwId);
  if (!section) return null;

  const calendar = await createSectionCalendar(section);
  return {
    cacheControl: PUBLIC_SECTION_CALENDAR_CACHE_CONTROL,
    filename: `life-ustc-${section.semesterId}-${section.code}.ics`,
    text: calendar.toString(),
  };
}
