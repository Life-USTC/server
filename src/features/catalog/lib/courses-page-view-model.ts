import type {
  CourseListCommonLabels,
  CourseListFilterOptions,
  CourseListFilters,
} from "@/features/catalog/components/catalog-course-list-types";
import {
  catalogHref,
  catalogPrimaryName,
} from "@/features/catalog/lib/catalog-list-display";

export function buildCourseFilterOptions(input: {
  commonLabels: CourseListCommonLabels;
  filterOptions: CourseListFilterOptions;
}) {
  return {
    categoryOptions: [
      { value: "", label: input.commonLabels.allCategories },
      ...input.filterOptions.categories.map((item) => ({
        value: String(item.id),
        label: catalogPrimaryName(item),
      })),
    ],
    classTypeOptions: [
      { value: "", label: input.commonLabels.allClassTypes },
      ...input.filterOptions.classTypes.map((item) => ({
        value: String(item.id),
        label: catalogPrimaryName(item),
      })),
    ],
    educationLevelOptions: [
      { value: "", label: input.commonLabels.allEducationLevels },
      ...input.filterOptions.educationLevels.map((item) => ({
        value: String(item.id),
        label: catalogPrimaryName(item),
      })),
    ],
  };
}

export function coursePageHref(input: {
  filters: CourseListFilters;
  targetPage: number;
}) {
  const { search, educationLevelId, categoryId, classTypeId } = input.filters;
  return catalogHref(
    "/courses",
    { categoryId, classTypeId, educationLevelId, search },
    input.targetPage,
  );
}

export function courseFilterHref(input: {
  courseSearch: string;
  filters: CourseListFilters;
  overrides: {
    educationLevelId?: string;
    categoryId?: string;
    classTypeId?: string;
  };
}) {
  const search = input.courseSearch.trim();
  const educationLevelId =
    input.overrides.educationLevelId ?? input.filters.educationLevelId ?? "";
  const categoryId =
    input.overrides.categoryId ?? input.filters.categoryId ?? "";
  const classTypeId =
    input.overrides.classTypeId ?? input.filters.classTypeId ?? "";
  return catalogHref("/courses", {
    categoryId,
    classTypeId,
    educationLevelId,
    search,
  });
}

export function activeCourseFilterCount(filters: CourseListFilters) {
  return [
    filters.search,
    filters.educationLevelId,
    filters.categoryId,
    filters.classTypeId,
  ].filter(Boolean).length;
}
