import type { HomeworkStyleGuideCopy } from "@/features/homeworks/lib/homework-style-guide";

export type HomeworkFormCopy = HomeworkStyleGuideCopy & {
  descriptionLabel: string;
  descriptionPlaceholder: string;
  titleLabel: string;
  titlePlaceholder: string;
};

export type HomeworkFormCommentsCopy = {
  markdownGuide: string;
  previewEmpty: string;
  tabPreview: string;
  tabWrite: string;
};

export type HomeworkTimestampCopy = {
  advancedHide: string;
  advancedShow: string;
  calendarButtonLabel: string;
  dueDateShortcuts: string;
  helperClear: string;
  helperMonth: string;
  helperPublishNow: string;
  helperSemesterEnd: string;
  helperSemesterStart?: string;
  helperStartNow: string;
  helperWeek: string;
  publishedAt: string;
  submissionDue: string;
  submissionStart: string;
};

export type HomeworkTagCopy = {
  tagMajor: string;
  tagTeam: string;
};

export type HomeworkTimestampActions = {
  dueAtSemesterEnd?: () => void;
  dueInMonth?: () => void;
  dueInWeek?: () => void;
  publishNow?: () => void;
  startAtSemesterStart?: () => void;
  startNow?: () => void;
};

export type HomeworkTimestampCapabilities = {
  hasSemesterEnd?: boolean;
  hasSemesterStart?: boolean;
};
