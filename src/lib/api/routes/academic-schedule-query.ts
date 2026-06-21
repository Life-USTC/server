import type { ScheduleListFilters } from "@/features/catalog/lib/schedule-filters";
import { parseInteger } from "@/lib/api/helpers";
import { parseScheduleDateParam } from "@/lib/api/routes/academic-route-helpers";

type AcademicScheduleQuery = {
  dateFrom?: string;
  dateTo?: string;
  roomId?: number | string;
  roomJwId?: number | string;
  sectionCode?: string;
  sectionId?: number | string;
  sectionJwId?: number | string;
  teacherCode?: string;
  teacherId?: number | string;
  weekday?: number | string;
};

export function parseAcademicScheduleFilters(
  parsedQuery: AcademicScheduleQuery,
) {
  const {
    sectionId,
    sectionJwId,
    sectionCode,
    teacherId,
    teacherCode,
    roomId,
    roomJwId,
    dateFrom,
    dateTo,
    weekday,
  } = parsedQuery;

  const parsedDateFrom = parseScheduleDateParam("dateFrom", dateFrom);
  if (parsedDateFrom instanceof Response) {
    return parsedDateFrom;
  }
  const parsedDateTo = parseScheduleDateParam("dateTo", dateTo);
  if (parsedDateTo instanceof Response) {
    return parsedDateTo;
  }

  const toNumber = (value: number | string | undefined) =>
    typeof value === "number"
      ? value
      : value
        ? (parseInteger(value) ?? undefined)
        : undefined;
  return {
    sectionId: toNumber(sectionId),
    sectionJwId: toNumber(sectionJwId),
    sectionCode,
    teacherId: toNumber(teacherId),
    teacherCode,
    roomId: toNumber(roomId),
    roomJwId: toNumber(roomJwId),
    weekday: toNumber(weekday),
    dateFrom: parsedDateFrom,
    dateTo: parsedDateTo,
  } satisfies ScheduleListFilters;
}
