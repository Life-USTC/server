import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import type messages from "../../../../messages/en-us.json";

export type SectionListLabels = typeof messages.sections;

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

export type SectionListOptionSource = CatalogNamed & {
  id: number | string;
  nameCn: string;
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
