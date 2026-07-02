import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";

export type TeacherListCommonLabels = {
  clear: string;
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
  filterDescription: string;
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
  subtitle: string;
  title_label: string;
};

export type TeacherListFilters = {
  departmentId?: string | null;
  search?: string | null;
};

export type TeacherListOption = {
  label: string;
  value: string;
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
