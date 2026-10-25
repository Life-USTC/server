import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import type { EndlessScrollLabels } from "@/lib/navigation/endless-list.svelte";
import type { TableFilterLabels } from "@/lib/table-filters";

export type CourseListCommonLabels = {
  tableFilters: TableFilterLabels;
  endlessScroll: EndlessScrollLabels;

  clear: string;
  applyFilters: string;
  loading: string;
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
  subtitle: string;
  summary: {
    filters: string;
  };
};

export type CourseListFilters = {
  name?: string | null;
  code?: string | null;

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
};

export type CourseListFilterUpdater = (
  patch: Partial<CourseListFilters>,
) => void;
