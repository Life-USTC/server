export type DashboardHomeworkCreateCopy = Record<string, string> & {
  advancedHide: string;
  advancedShow: string;
  cancel: string;
  createAction: string;
  createTitle: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  helperClear: string;
  helperMonth: string;
  helperPublishNow: string;
  helperSemesterEnd: string;
  helperStartNow: string;
  helperWeek: string;
  publishedAt: string;
  sectionLabel: string;
  saving: string;
  submissionDue: string;
  submissionStart: string;
  subtitle: string;
  tagMajor: string;
  tagTeam: string;
  titleLabel: string;
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
