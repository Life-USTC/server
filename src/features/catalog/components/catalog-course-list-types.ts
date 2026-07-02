import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";

export type CourseListCommonLabels = {
  allCategories: string;
  allClassTypes: string;
  allEducationLevels: string;
  clear: string;
  next: string;
  nextPage: string;
  pagination: string;
  previous: string;
  previousPage: string;
  search: string;
};

export type CourseListLabels = {
  category: string;
  classType: string;
  courseCode: string;
  courseName: string;
  educationLevel: string;
  noCoursesFound: string;
  searchFor: string;
  searchPlaceholder: string;
  showing: string;
  subtitle: string;
  summary: {
    filters: string;
  };
};

export type CourseListFilters = {
  categoryId?: string | null;
  classTypeId?: string | null;
  educationLevelId?: string | null;
  search?: string | null;
};

export type CourseListOptionSource = CatalogNamed & {
  id: string | number;
};

export type CourseListFilterOptions = {
  categories: CourseListOptionSource[];
  classTypes: CourseListOptionSource[];
  educationLevels: CourseListOptionSource[];
};

export type CourseListOption = {
  label: string;
  value: string;
};

export type CourseListRow = CatalogNamed & {
  category?: CatalogNamed | null;
  classType?: CatalogNamed | null;
  code: string;
  educationLevel?: CatalogNamed | null;
  jwId: number | string;
};

export type CourseListResultData = {
  data: CourseListRow[];
  filters: Pick<CourseListFilters, "search">;
  pagination: {
    total: number;
  };
};

export type CourseListFilterUpdater = (
  patch: Partial<CourseListFilters>,
) => void;
