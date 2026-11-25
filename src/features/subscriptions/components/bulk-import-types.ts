import type { AppPageCopy } from "@/lib/shell/page-copy";

export type BulkImportCopy = AppPageCopy["subscriptions"]["bulkImport"];

export type BulkImportSemesterOption = {
  label: string;
  value: string;
};

export type BulkImportSectionView = {
  campusName?: string;
  code: string;
  courseName: string;
  courseSecondaryName?: string;
  id: number;
  semesterName?: string;
  teacherNames?: string;
};

export type BulkImportFormatMessage = (
  value: string,
  params: Record<string, number | string>,
) => string;

export type BulkImportAction = () => unknown;

export type BulkImportSelectionSetter = (
  sectionId: number,
  checked: boolean,
) => void;
