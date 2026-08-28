export type BulkImportCopy = {
  cancel: string;
  confirmTitle: string;
  description: string;
  importing: string;
  matchButton: string;
  matchedSummary: string;
  matching: string;
  noMatches: string;
  placeholder: string;
  sectionCodesLabel: string;
  selectSection: string;
  semesterLabel: string;
  semesterPlaceholder: string;
  subscribeSelected: string;
  title: string;
  unmatchedCodes: string;
};

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
