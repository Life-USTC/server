import { formatDate, ICalCalendar } from "ical-generator";
import {
  appendSectionEvents,
  type CalendarHomework,
  type CalendarSection,
  type CalendarTodo,
  createHomeworkEvent,
  createTodoEvent,
  ICAL_SITE_URL,
  loadLocationAssets,
} from "@/features/calendar/server/ical-event-builders";
import type { AppLocale } from "@/i18n/config";
import { APP_TIME_ZONE } from "@/lib/time/parse-date-input";

function generateShanghaiVTimezone(timezone: string): string | null {
  if (timezone !== APP_TIME_ZONE) return null;
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${APP_TIME_ZONE}`,
    `X-LIC-LOCATION:${APP_TIME_ZONE}`,
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:CST",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
  ].join("\r\n");
}

const SHANGHAI_TZ_CONFIG = {
  name: APP_TIME_ZONE,
  generator: generateShanghaiVTimezone,
};

export class Rfc5545Calendar extends ICalCalendar {
  override toString(): string {
    const events = this.events();
    let eventIndex = 0;

    // ical-generator applies the calendar timezone to DTSTAMP, but RFC 5545
    // requires that property to be serialized as UTC for every VEVENT.
    return super.toString().replace(/^DTSTAMP:[^\r\n]*/gm, (line) => {
      const event = events[eventIndex++];
      return event ? `DTSTAMP:${formatDate(null, event.stamp())}` : line;
    });
  }
}

function createCalendar(name: string, description: string, url: string) {
  return new Rfc5545Calendar({
    name,
    description,
    timezone: SHANGHAI_TZ_CONFIG,
    url,
    scale: "GREGORIAN",
  });
}

export async function createSectionCalendar(
  section: CalendarSection,
  locale: AppLocale = "zh-cn",
) {
  const calendar = createCalendar(
    `${section.course.nameCn} (${section.code})`,
    `Calendar for ${section.course.nameCn} (${section.code}), brought to you by Life@USTC`,
    `${ICAL_SITE_URL}/catalog/sections/${section.jwId}`,
  );

  const [geoData, roomMaps] = await loadLocationAssets();
  appendSectionEvents(calendar, [section], geoData, roomMaps, locale);
  return calendar;
}

export async function createMultiSectionCalendar(
  sections: CalendarSection[],
  locale: AppLocale = "zh-cn",
) {
  const calendar = createCalendar(
    "Life @ USTC",
    `Calendar for subscribed courses, brought to you by Life@USTC <${ICAL_SITE_URL}/>`,
    ICAL_SITE_URL,
  );

  const [geoData, roomMaps] = await loadLocationAssets();
  appendSectionEvents(calendar, sections, geoData, roomMaps, locale);
  return calendar;
}

export async function createUserCalendar({
  sections,
  homeworks,
  todos,
  youngEvents = [],
  locale = "zh-cn",
}: {
  sections: CalendarSection[];
  homeworks: CalendarHomework[];
  todos: CalendarTodo[];
  youngEvents?: Array<{
    youngId: string;
    name: string;
    startAt: Date | null;
    endAt: Date | null;
    location: string | null;
    sourceMissing: boolean;
    lastSeenAt: Date | null;
  }>;
  locale?: AppLocale;
}) {
  const calendar = createCalendar(
    "Life @ USTC",
    `Calendar for the current user, including subscribed courses and personal deadlines, brought to you by Life@USTC <${ICAL_SITE_URL}/>`,
    ICAL_SITE_URL,
  );

  const [geoData, roomMaps] = await loadLocationAssets();
  appendSectionEvents(calendar, sections, geoData, roomMaps, locale);
  for (const homework of homeworks)
    createHomeworkEvent(homework, calendar, locale);
  for (const todo of todos) createTodoEvent(todo, calendar, locale);
  for (const event of youngEvents) {
    if (!event.startAt) continue;
    calendar.createEvent({
      id: `young-${event.youngId}@life-ustc`,
      start: event.startAt,
      ...(event.endAt && event.endAt > event.startAt
        ? { end: event.endAt }
        : {}),
      summary: event.name,
      location: event.location ?? undefined,
      url: `${ICAL_SITE_URL}/catalog/young-events/${encodeURIComponent(event.youngId)}`,
      description: event.sourceMissing
        ? "来源暂缺，请核实校方信息 / Source unavailable; verify official details."
        : "订阅活动不等于校方报名 / Subscribing does not register attendance.",
      lastModified: event.lastSeenAt ?? undefined,
    });
  }
  return calendar;
}
