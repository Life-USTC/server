import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import type messages from "../../../../messages/en-us.json";

export type CourseListLabels = typeof messages.courses;

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
