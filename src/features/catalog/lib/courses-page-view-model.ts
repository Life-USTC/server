import type { CourseListFilterOptions } from "@/features/catalog/components/catalog-course-list-types";
import {
  catalogEducationLevelName,
  catalogPrimaryName,
} from "./catalog-list-display";

export function buildCourseFilterOptions(
  filterOptions: CourseListFilterOptions,
) {
  const options = (items: CourseListFilterOptions["categories"]) =>
    items.map((item) => ({
      value: String(item.id),
      label: catalogPrimaryName(item),
    }));
  return {
    categoryOptions: options(filterOptions.categories),
    classTypeOptions: options(filterOptions.classTypes),
    educationLevelOptions: filterOptions.educationLevels.map((item) => ({
      value: String(item.id),
      label: catalogEducationLevelName(item),
    })),
  };
}
