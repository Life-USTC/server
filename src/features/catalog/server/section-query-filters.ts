import type { SectionListFilters } from "@/features/catalog/server/course-section-filter-types";
import { buildSectionSearchWhere } from "@/features/catalog/server/section-search-query";
import type { Prisma } from "@/generated/prisma/client";
import {
  applyIntegerFilter,
  buildJwIdFilter,
  buildRelatedFilter,
  parseIdsFilter,
} from "@/lib/query-filter-helpers";

export function buildSectionListQuery(filters: SectionListFilters): {
  where: Prisma.SectionWhereInput;
  orderBy?: ReturnType<typeof buildSectionSearchWhere>["orderBy"];
} {
  const {
    courseId,
    semesterId,
    semesterJwId,
    campusId,
    departmentId,
    teacherId,
    teacherCode,
    ids,
    jwIds,
    search,
  } = filters;
  const where: Prisma.SectionWhereInput = {};

  applyIntegerFilter(where, "courseId", courseId);

  applyIntegerFilter(where, "semesterId", semesterId);
  const semesterFilter = buildJwIdFilter(semesterJwId);
  if (semesterFilter) {
    where.semester = semesterFilter;
  }

  applyIntegerFilter(where, "campusId", campusId);
  applyIntegerFilter(where, "openDepartmentId", departmentId);

  const teacherFilter = buildRelatedFilter("id", teacherId, teacherCode);
  if (teacherFilter) {
    where.teachers = {
      some: teacherFilter,
    };
  }

  const parsedIds = parseIdsFilter(ids);
  if (parsedIds.length > 0) {
    where.id = { in: parsedIds };
  }
  const parsedJwIds = parseIdsFilter(jwIds);
  if (parsedJwIds.length > 0) {
    where.jwId = { in: parsedJwIds };
  }

  const searchFilters = buildSectionSearchWhere(search ?? undefined);
  if (searchFilters.where?.AND) {
    const searchAnd = Array.isArray(searchFilters.where.AND)
      ? searchFilters.where.AND
      : [searchFilters.where.AND];
    const existingAnd = Array.isArray(where.AND)
      ? where.AND
      : where.AND
        ? [where.AND]
        : [];
    where.AND = [...existingAnd, ...searchAnd];
  }

  return {
    where,
    orderBy: searchFilters.orderBy,
  };
}
