import type { ICalCalendar } from "ical-generator";
import type { AppLocale } from "@/i18n/config";
import type { CalendarSection } from "@/lib/ical-event-types";
import type { GeoData, ImgRules } from "@/lib/ical-event-utils";
import { createExamEvent } from "@/lib/ical-section-exam-event";
import { createScheduleEvent } from "@/lib/ical-section-schedule-event";

export function appendSectionEvents(
  calendar: ICalCalendar,
  sections: CalendarSection[],
  geoData: GeoData,
  imgRules: ImgRules,
  locale: AppLocale,
) {
  for (const section of sections) {
    for (const schedule of section.schedules) {
      createScheduleEvent(
        schedule,
        section,
        calendar,
        geoData,
        imgRules,
        locale,
      );
    }
    for (const exam of section.exams) {
      createExamEvent(exam, section, calendar, geoData, imgRules, locale);
    }
  }
}
