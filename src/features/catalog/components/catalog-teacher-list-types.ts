import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import type { TableFilterLabels } from "@/lib/table-filters";

export type TeacherListCommonLabels = {
  tableFilters: TableFilterLabels;

  clear: string;
  applyFilters: string;
  loading: string;
  next: string;
  nextPage: string;
  pagination: string;
  previous: string;
  previousPage: string;
  search: string;
  unknown: string;
};

export type TeacherListLabels = {
  code: string;
  department: string;
  email: string;
  emptyDescription: string;
  filterTitle: string;
  inDepartment: string;
  name: string;
  noDepartment: string;
  noTeachersFound: string;
  pageOf: string;
  searchFor: string;
  searchLabel: string;
  searchNameOrCode: string;
  sections: string;
  showing: string;
  showingOne: string;
  subtitle: string;
  title_label: string;
};

export type TeacherListFilters = {
  name?: string | null;
  code?: string | null;
  email?: string | null;
  teacherTitleId?: string | null;
  sectionCount?: string | null;
  sectionCountOp?: string | null;
  sectionCountMax?: string | null;

  departmentId?: string | null;
  search?: string | null;
};

export type TeacherListRow = CatalogNamed & {
  _count: {
    sections: number;
  };
  code?: string | null;
  department?: CatalogNamed | null;
  email?: string | null;
  id: string | number;
  teacherTitle?: CatalogNamed | null;
};

export type TeacherListFilterUpdater = (
  patch: Partial<TeacherListFilters>,
) => void;
