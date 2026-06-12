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
import { examTypeLabel, getIcalLabels } from "@/lib/ical-labels";
import { lookupBuildingImagePath } from "@/lib/location-utils";
import { APP_TIME_ZONE } from "@/lib/time/parse-date-input";

export function createExamEvent(
  exam: Prisma.ExamGetPayload<{ include: { examRooms: true } }>,
  section: Prisma.SectionGetPayload<{ include: { course: true } }>,
  calendar: ICalCalendar,
  geoData: GeoData,
  imgRules: ImgRules,
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

  const description = [
    `${section.course.nameCn} (${section.code})`,
    `${L.examTypePrefix}${typeLabel}`,
    exam.examMode && `${L.examModePrefix}${exam.examMode}`,
    exam.examTakeCount && `${L.examTakeCountPrefix}${exam.examTakeCount}`,
    rooms && `${L.examRoomPrefix}${rooms}`,
  ]
    .filter(Boolean)
    .join("\n");

  const buildingImg =
    exam.examRooms.length > 0
      ? lookupBuildingImagePath(imgRules, exam.examRooms[0].room)
      : null;

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
    attachments: buildingImg ? [buildingImg] : undefined,
  });
}
