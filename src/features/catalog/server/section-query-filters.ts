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
    categoryId,
    educationLevelId,
    classTypeId,
    teacherId,
    teacherCode,
    teacher,
    courseCode,
    sectionCode,
    credits,
    sort,
    order,
    ids,
    jwIds,
    search,
  } = filters;
  const where: Prisma.SectionWhereInput = { retiredAt: null };

  applyIntegerFilter(where, "courseId", courseId);

  applyIntegerFilter(where, "semesterId", semesterId);
  const semesterFilter = buildJwIdFilter(semesterJwId);
  if (semesterFilter) {
    where.semester = semesterFilter;
  }

  applyIntegerFilter(where, "campusId", campusId);
  applyIntegerFilter(where, "openDepartmentId", departmentId);

  const courseMetadataFilter: Prisma.CourseWhereInput = {};
  applyIntegerFilter(courseMetadataFilter, "categoryId", categoryId);
  applyIntegerFilter(
    courseMetadataFilter,
    "educationLevelId",
    educationLevelId,
  );
  applyIntegerFilter(courseMetadataFilter, "classTypeId", classTypeId);

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

  const searchFilters = buildSectionSearchWhere(search ?? undefined, {
    teacher,
    courseCode,
    sectionCode,
    credits,
    sort,
    order,
  });
  const extraAnd: Prisma.SectionWhereInput[] = [];
  if (Object.keys(courseMetadataFilter).length > 0) {
    extraAnd.push({ course: courseMetadataFilter });
  }
  if (searchFilters.where?.AND) {
    const searchAnd = Array.isArray(searchFilters.where.AND)
      ? searchFilters.where.AND
      : [searchFilters.where.AND];
    extraAnd.push(...searchAnd);
  }
  if (extraAnd.length > 0) {
    where.AND = extraAnd;
  }

  return {
    where,
    orderBy: searchFilters.orderBy,
  };
}
