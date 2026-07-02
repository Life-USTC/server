import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";

export type SectionListCommonLabels = {
  clear: string;
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
  courseName: string;
  credits: string;
  creditValue: string;
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
  search?: string | null;
  semesterId?: string | null;
};

export type SectionListOption = {
  label: string;
  value: string;
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
