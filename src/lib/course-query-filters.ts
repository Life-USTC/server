import type { Prisma } from "@/generated/prisma/client";
import type { CourseListFilters } from "@/lib/course-section-filter-types";
import { applyIntegerFilter } from "@/lib/query-filter-helpers";
import { ilike } from "@/lib/query-helpers";

export function buildCourseListWhere(
  filters: CourseListFilters,
): Prisma.CourseWhereInput | undefined {
  const { search, educationLevelId, categoryId, classTypeId } = filters;
  const where: Prisma.CourseWhereInput = {};

  if (search) {
    where.OR = [
      { nameCn: ilike(search) },
      { nameEn: ilike(search) },
      { code: ilike(search) },
    ];
  }

  applyIntegerFilter(where, "educationLevelId", educationLevelId);
  applyIntegerFilter(where, "categoryId", categoryId);
  applyIntegerFilter(where, "classTypeId", classTypeId);

  return Object.keys(where).length > 0 ? where : undefined;
}
