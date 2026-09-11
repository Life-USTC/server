import type { HomeworkDueShortcutCopy } from "@/features/homeworks/lib/homework-due-shortcuts";
import type { HomeworkStyleGuideCopy } from "@/features/homeworks/lib/homework-style-guide";

export type {
  HomeworkDueShortcut,
  HomeworkDueShortcutCopy,
} from "@/features/homeworks/lib/homework-due-shortcuts";

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

export type HomeworkTimestampCopy = HomeworkDueShortcutCopy & {
  advancedHide: string;
  advancedShow: string;
  calendarButtonLabel: string;
  dueDateShortcuts: string;
  timeShortcuts: string;
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
