import { type ICalCalendar, ICalEventBusyStatus } from "ical-generator";
import { ICAL_SITE_URL } from "@/features/calendar/server/ical-event-constants";
import {
  buildLocationField,
  eventTimeRange,
  type GeoData,
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
      teacherParticipations: { include: { teacher: true } };
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
  const { start, end } = eventTimeRange(
    schedule.date,
    schedule.startTime,
    schedule.endTime,
  );

  const location =
    schedule.customPlace ||
    schedule.room?.nameCn ||
    schedule.room?.code ||
    L.locationTbd;

  const teacherNames =
    schedule.teacherParticipations?.length > 0
      ? schedule.teacherParticipations
          .map(({ teacher: t }) =>
            [t.nameCn, t.nameEn].filter(Boolean).join(" / "),
          )
          .join(", ")
      : "";

  const rawCode = schedule.room?.code;
  const roomMap =
    typeof rawCode === "string" && roomCodeSchema.safeParse(rawCode).success
      ? lookupRoomMap(rawCode, roomMaps)
      : null;
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
