import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";

export type SectionListCommonLabels = {
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
  category: string;
  classType: string;
  courseName: string;
  courseCode: string;
  credits: string;
  creditValue: string;
  department: string;
  educationLevel: string;
  filterDescription: string;
  filters: {
    any: string;
    apply: string;
    courseDescription: string;
    courseTitle: string;
    defaultSort: string;
    exactCredits: string;
    order: string;
    orderAsc: string;
    orderDesc: string;
    sectionDescription: string;
    sectionTitle: string;
    sortBy: string;
    sortCampus: string;
    sortCapacity: string;
    sortCode: string;
    sortCourse: string;
    sortCredits: string;
    sortSemester: string;
    sortTeacherCount: string;
    sortingDescription: string;
    sortingTitle: string;
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
  subtitle: string;
  summary: {
    filters: string;
  };
  teachers: string;
  close: string;
};

export type SectionListFilters = {
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

export type SectionListFilterUpdater = (
  patch: Partial<SectionListFilters>,
) => void;
