import { type ICalCalendar, ICalEventBusyStatus } from "ical-generator";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { ICAL_SITE_URL } from "@/lib/ical-event-constants";
import {
  buildLocationField,
  type GeoData,
  type ImgRules,
  parseTimeHHMM,
  toCategories,
} from "@/lib/ical-event-utils";
import { getIcalLabels } from "@/lib/ical-labels";
import { lookupBuildingImagePath } from "@/lib/location-utils";
import { APP_TIME_ZONE } from "@/lib/time/parse-date-input";

export function createScheduleEvent(
  schedule: Prisma.ScheduleGetPayload<{
    include: {
      room: { include: { building: { include: { campus: true } } } };
      teachers: true;
    };
  }>,
  section: Prisma.SectionGetPayload<{ include: { course: true } }>,
  calendar: ICalCalendar,
  geoData: GeoData,
  imgRules: ImgRules,
  locale: AppLocale,
) {
  if (!schedule.date) return;

  const L = getIcalLabels(locale);
  const start = parseTimeHHMM(schedule.date, schedule.startTime);
  const end = parseTimeHHMM(schedule.date, schedule.endTime);

  const location = schedule.room?.building?.campus
    ? `${schedule.room.nameCn} (${schedule.room.building.campus.nameCn}-${schedule.room.building.nameCn})`
    : schedule.customPlace || L.locationTbd;

  const teacherNames =
    schedule.teachers?.length > 0
      ? schedule.teachers
          .map((t) => [t.nameCn, t.nameEn].filter(Boolean).join(" / "))
          .join(", ")
      : "";

  const description = [
    section.course.nameCn,
    teacherNames && `${L.teacherPrefix}${teacherNames}`,
    schedule.experiment && `${L.experimentPrefix}${schedule.experiment}`,
  ]
    .filter(Boolean)
    .join("\n");

  const buildingImg = schedule.room?.code
    ? lookupBuildingImagePath(imgRules, schedule.room.code)
    : null;

  calendar.createEvent({
    start,
    end,
    timezone: APP_TIME_ZONE,
    summary: section.course.nameCn,
    description,
    location: buildLocationField(location, geoData),
    id: `${ICAL_SITE_URL}/schedule/${schedule.id}`,
    sequence: 0,
    busystatus: ICalEventBusyStatus.BUSY,
    categories: toCategories([
      L.courseCategory,
      section.course.nameCn,
      section.code,
      section.course.code,
    ]),
    attachments: buildingImg ? [buildingImg] : undefined,
  });
}
