import { type ICalCalendar, ICalEventBusyStatus } from "ical-generator";
import { ICAL_SITE_URL } from "@/features/calendar/server/ical-event-constants";
import {
  buildLocationField,
  type GeoData,
  parseTimeHHMM,
  type RoomMaps,
  toCategories,
} from "@/features/calendar/server/ical-event-utils";
import {
  examTypeLabel,
  getIcalLabels,
} from "@/features/calendar/server/ical-labels";
import { roomCodeSchema } from "@/features/rooms/server/room-map-schema";
import { lookupRoomMap } from "@/features/rooms/server/room-map-service";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { APP_TIME_ZONE } from "@/lib/time/parse-date-input";

export function createExamEvent(
  exam: Prisma.ExamGetPayload<{ include: { examRooms: true } }>,
  section: Prisma.SectionGetPayload<{ include: { course: true } }>,
  calendar: ICalCalendar,
  geoData: GeoData,
  roomMaps: RoomMaps,
  locale: AppLocale,
) {
  if (!exam.examDate) return;

  const L = getIcalLabels(locale);
  const start = parseTimeHHMM(exam.examDate, exam.startTime ?? 0);
  const end = parseTimeHHMM(exam.examDate, exam.endTime ?? 0);

  const rooms = exam.examRooms
    .map((r) => r.room)
    .filter(Boolean)
    .join(", ");
  const location = rooms || L.examLocationTbd;
  const typeLabel = examTypeLabel(exam.examType, locale);

  const maps = exam.examRooms.flatMap(({ room }) => {
    const code = roomCodeSchema.safeParse(room);
    if (!code.success) return [];
    const map = lookupRoomMap(code.data, roomMaps);
    return map.imageUrl ? [map] : [];
  });
  const imageUrls = [
    ...new Set(maps.flatMap((map) => (map.imageUrl ? [map.imageUrl] : []))),
  ];

  const description = [
    `${section.course.nameCn} (${section.code})`,
    `${L.examTypePrefix}${typeLabel}`,
    exam.examMode && `${L.examModePrefix}${exam.examMode}`,
    exam.examTakeCount && `${L.examTakeCountPrefix}${exam.examTakeCount}`,
    rooms && `${L.examRoomPrefix}${rooms}`,
    ...maps.map((map) => `${L.roomMapPrefix}${map.code}: ${map.imageUrl}`),
  ]
    .filter(Boolean)
    .join("\n");

  calendar.createEvent({
    start,
    end,
    timezone: APP_TIME_ZONE,
    summary: `${section.course.nameCn} - ${typeLabel}`,
    description,
    location: buildLocationField(location, geoData),
    id: `${ICAL_SITE_URL}/exam/${exam.id}`,
    sequence: 0,
    busystatus: ICalEventBusyStatus.BUSY,
    categories: toCategories([
      L.examCategory,
      typeLabel,
      section.course.nameCn,
      section.code,
      section.course.code,
    ]),
    attachments: imageUrls,
  });
}
