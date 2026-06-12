import { ICalCalendar } from "ical-generator";
import type { AppLocale } from "@/i18n/config";
import {
  appendSectionEvents,
  type CalendarHomework,
  type CalendarSection,
  type CalendarTodo,
  createHomeworkEvent,
  createTodoEvent,
  ICAL_SITE_URL,
  loadLocationAssets,
} from "@/lib/ical-event-builders";
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

function createCalendar(name: string, description: string, url: string) {
  return new ICalCalendar({
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
    `${ICAL_SITE_URL}/sections/${section.jwId}`,
  );

  const [geoData, imgRules] = await loadLocationAssets();
  appendSectionEvents(calendar, [section], geoData, imgRules, locale);
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

  const [geoData, imgRules] = await loadLocationAssets();
  appendSectionEvents(calendar, sections, geoData, imgRules, locale);
  return calendar;
}

export async function createUserCalendar({
  sections,
  homeworks,
  todos,
  locale = "zh-cn",
}: {
  sections: CalendarSection[];
  homeworks: CalendarHomework[];
  todos: CalendarTodo[];
  locale?: AppLocale;
}) {
  const calendar = createCalendar(
    "Life @ USTC",
    `Calendar for the current user, including subscribed courses and personal deadlines, brought to you by Life@USTC <${ICAL_SITE_URL}/>`,
    ICAL_SITE_URL,
  );

  const [geoData, imgRules] = await loadLocationAssets();
  appendSectionEvents(calendar, sections, geoData, imgRules, locale);
  for (const homework of homeworks)
    createHomeworkEvent(homework, calendar, locale);
  for (const todo of todos) createTodoEvent(todo, calendar, locale);
  return calendar;
}
