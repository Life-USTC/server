import type { ICalCalendar } from "ical-generator";
import type { CalendarSection } from "@/features/calendar/server/ical-event-types";
import type {
  GeoData,
  ImgRules,
} from "@/features/calendar/server/ical-event-utils";
import { createExamEvent } from "@/features/calendar/server/ical-section-exam-event";
import { createScheduleEvent } from "@/features/calendar/server/ical-section-schedule-event";
import type { AppLocale } from "@/i18n/config";

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
