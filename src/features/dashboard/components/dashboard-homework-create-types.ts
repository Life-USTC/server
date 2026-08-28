import type {
  HomeworkFormCopy,
  HomeworkTagCopy,
  HomeworkTimestampCopy,
} from "@/features/homeworks/components/homework-form-types";

export type DashboardHomeworkCreateCopy = HomeworkFormCopy &
  HomeworkTagCopy &
  HomeworkTimestampCopy & {
    [key: string]: string;
    cancel: string;
    createAction: string;
    createTitle: string;
    sectionLabel: string;
    saving: string;
    subtitle: string;
  };

export type DashboardHomeworkCommentsCopy = {
  markdownGuide: string;
  markdownModeLabel: string;
  previewEmpty: string;
  tabPreview: string;
  tabWrite: string;
};

export type DashboardHomeworkCreateSection = {
  course?: {
    code?: string | null;
    name?: string | null;
  } | null;
  courseCode?: string | null;
  courseName?: string | null;
  id: number | string;
  semesterEnd?: string | null;
  semesterName?: string | null;
  teacherName?: string | null;
};

export type DashboardHomeworkCreateSectionGetter =
  () => DashboardHomeworkCreateSection | null;

export type DashboardHomeworkDateShortcut = () => void;
