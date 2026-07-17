import type { Prisma } from "@/generated/prisma/client";
import {
  applyIntegerFilter,
  buildJwIdFilter,
  buildRelatedFilter,
  type IntegerFilter,
} from "@/lib/query-filter-helpers";

export type ScheduleListFilters = {
  sectionId?: IntegerFilter;
  sectionJwId?: IntegerFilter;
  sectionCode?: string | null;
  teacherId?: IntegerFilter;
  teacherCode?: string | null;
  roomId?: IntegerFilter;
  roomJwId?: IntegerFilter;
  weekday?: IntegerFilter;
  dateFrom?: Date;
  dateTo?: Date;
};

export function buildScheduleDateWhere(
  input: Pick<ScheduleListFilters, "dateFrom" | "dateTo">,
) {
  return input.dateFrom || input.dateTo
    ? {
        date: {
          ...(input.dateFrom && { gte: input.dateFrom }),
          ...(input.dateTo && { lte: input.dateTo }),
        },
      }
    : {};
}

export function buildScheduleListWhere(
  filters: ScheduleListFilters,
  options: { excludeRetiredSections?: boolean } = {},
) {
  const {
    sectionId,
    sectionJwId,
    sectionCode,
    teacherId,
    teacherCode,
    roomId,
    roomJwId,
    weekday,
  } = filters;

  const where: Prisma.ScheduleWhereInput = {};

  applyIntegerFilter(where, "sectionId", sectionId);

  const sectionFilter = buildRelatedFilter("jwId", sectionJwId, sectionCode);
  if (sectionFilter || options.excludeRetiredSections) {
    where.section = {
      ...(sectionFilter ?? {}),
      ...(options.excludeRetiredSections ? { retiredAt: null } : {}),
    };
  }

  const teacherFilter = buildRelatedFilter("id", teacherId, teacherCode);
  if (teacherFilter) {
    where.teachers = { some: teacherFilter };
  }

  applyIntegerFilter(where, "roomId", roomId);

  const roomFilter = buildJwIdFilter(roomJwId);
  if (roomFilter) {
    where.room = roomFilter;
  }

  Object.assign(where, buildScheduleDateWhere(filters));
  applyIntegerFilter(where, "weekday", weekday);

  return where;
}
