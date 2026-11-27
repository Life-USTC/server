import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import type messages from "../../../../messages/en-us.json";

export type TeacherListCommonLabels = typeof messages.common;
export type TeacherListLabels = typeof messages.teachers;

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
