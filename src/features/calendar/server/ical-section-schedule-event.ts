import { type ICalCalendar, ICalEventBusyStatus } from "ical-generator";
import { ICAL_SITE_URL } from "@/features/calendar/server/ical-event-constants";
import {
  buildLocationField,
  type GeoData,
  parseTimeHHMM,
  type RoomMaps,
  toCategories,
} from "@/features/calendar/server/ical-event-utils";
import { getIcalLabels } from "@/features/calendar/server/ical-labels";
import { roomCodeSchema } from "@/features/rooms/server/room-map-schema";
import { lookupRoomMap } from "@/features/rooms/server/room-map-service";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
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
  roomMaps: RoomMaps,
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

  const code = roomCodeSchema.safeParse(schedule.room?.code);
  const roomMap = code.success ? lookupRoomMap(code.data, roomMaps) : null;
  const imageUrl = roomMap?.imageUrl;

  const description = [
    section.course.nameCn,
    imageUrl && `${L.roomMapPrefix}${roomMap?.code}: ${imageUrl}`,
    teacherNames && `${L.teacherPrefix}${teacherNames}`,
    schedule.experiment && `${L.experimentPrefix}${schedule.experiment}`,
  ]
    .filter(Boolean)
    .join("\n");

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
    attachments: imageUrl ? [imageUrl] : undefined,
  });
}
