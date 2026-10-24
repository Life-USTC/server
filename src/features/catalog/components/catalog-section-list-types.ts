import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import type { TableFilterLabels } from "@/lib/table-filters";

export type SectionListCommonLabels = {
  tableFilters: TableFilterLabels;
  applyFilters: string;

  clear: string;
  loading: string;
  next: string;
  nextPage: string;
  pagination: string;
  previous: string;
  previousPage: string;
  search: string;
};

export type SectionListLabels = {
  campus: string;
  capacity: string;
  enrolled: string;
  enrollmentLimit: string;
  teacherCount: string;
  category: string;
  classType: string;
  courseName: string;
  courseCode: string;
  credits: string;
  department: string;
  educationLevel: string;
  filters: {
    any: string;
    apply: string;
    defaultSort: string;
    exactCredits: string;
    orderAsc: string;
    orderDesc: string;
    sortBy: string;
    sortCampus: string;
    sortCapacity: string;
    sortCode: string;
    sortCourse: string;
    sortCredits: string;
    sortSemester: string;
    sortTeacherCount: string;
  };
  inSemester: string;
  noSectionsFound: string;
  noSemester: string;
  searchFor: string;
  searchHelp: string;
  searchHelpDescription: string;
  searchHelpExamples: Array<{
    description: string;
    example: string;
    syntax: string;
  }>;
  searchHelpTitle: string;
  searchPlaceholder: string;
  sectionCode: string;
  semester: string;
  showing: string;
  showingOne: string;
  subtitle: string;
  summary: {
    filters: string;
  };
  teachers: string;
  close: string;
};

export type SectionListFilters = {
  courseName?: string | null;
  creditsOp?: string | null;
  creditsMax?: string | null;
  stdCount?: string | null;
  stdCountOp?: string | null;
  stdCountMax?: string | null;
  limitCount?: string | null;
  limitCountOp?: string | null;
  limitCountMax?: string | null;
  teacherCount?: string | null;
  teacherCountOp?: string | null;
  teacherCountMax?: string | null;

  campusId?: string | null;
  categoryId?: string | null;
  classTypeId?: string | null;
  courseCode?: string | null;
  credits?: string | null;
  departmentId?: string | null;
  educationLevelId?: string | null;
  order?: "asc" | "desc" | null;
  search?: string | null;
  sectionCode?: string | null;
  semesterId?: string | null;
  sort?: string | null;
  teacher?: string | null;
};

export type SectionListOption = {
  label: string;
  value: string;
};

export type SectionListOptionSource = CatalogNamed & {
  id: number | string;
  nameCn: string;
};

export type SectionListPagination = {
  total: number;
};

export type SectionListSemester = {
  nameCn: string;
};

export type SectionListRow = {
  campus?: CatalogNamed | null;
  code: string;
  course: CatalogNamed;
  credits?: number | null;
  jwId: string | number;
  limitCount?: number | null;
  semester?: SectionListSemester | null;
  stdCount?: number | null;
  teachers: CatalogNamed[];
};

export type SectionListResultData = {
  data: SectionListRow[];
  filters: SectionListFilters;
  pagination: SectionListPagination;
};
