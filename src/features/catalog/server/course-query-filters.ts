import type { CourseListFilters } from "@/features/catalog/server/course-section-filter-types";
import type { Prisma } from "@/generated/prisma/client";
import { applyIntegerFilter, ilike } from "@/lib/query-filter-helpers";

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
