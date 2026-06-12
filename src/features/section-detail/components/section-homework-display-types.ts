export type SectionHomeworkDateValue = Date | string | null | undefined;

export type SectionHomeworkCopy = Record<string, string> & {
  auditEmpty: string;
  auditMeta: string;
  auditTitle: string;
  cancel: string;
  contentHistoryAction: string;
  contentHistoryActor: string;
  deleteAction: string;
  deleteDescription: string;
  deleteTitle: string;
  descriptionEmpty: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  editAction: string;
  helperClear: string;
  helperMonth: string;
  helperPublishNow: string;
  helperSemesterEnd: string;
  helperSemesterStart: string;
  helperStartNow: string;
  helperWeek: string;
  markComplete: string;
  markIncomplete: string;
  publishedAt: string;
  saveChanges: string;
  submissionDue: string;
  submissionStart: string;
  tagMajor: string;
  tagTeam: string;
  titleLabel: string;
};

export type SectionHomeworkSectionCopy = {
  close?: string;
};

export type SectionHomeworkCommonCopy = {
  unknown: string;
};

export type SectionHomeworkDisplay = {
  completion: { completedAt: string | null } | null;
  description?: {
    content?: string | null;
  } | null;
  id: string;
  isMajor: boolean;
  publishedAt?: SectionHomeworkDateValue;
  requiresTeam: boolean;
  submissionDueAt: Date | string | null;
  submissionStartAt?: SectionHomeworkDateValue;
  title: string;
};

export type SectionHomeworkFormatter = (
  value: SectionHomeworkDateValue,
) => string;

export type SectionHomeworkAction = (
  homework: SectionHomeworkDisplay,
) => void | Promise<void>;

export type SectionHomeworkAuditLog = {
  action: string;
  actor?: {
    name?: string | null;
    username?: string | null;
  } | null;
  createdAt?: SectionHomeworkDateValue;
  homeworkId: string | null;
  id: string | number;
  titleSnapshot?: string | null;
};

export type SectionHomeworkTimestampAction = () => void;

export type SectionHomeworkSemesterDate = (
  boundary: "start" | "end",
) => SectionHomeworkDateValue;

export type SectionHomeworkMarkdownCopy = {
  markdownGuide: string;
  previewEmpty: string;
  tabPreview: string;
  tabWrite: string;
};

export type SectionHomeworkSubmitHandler = (
  event: SubmitEvent,
) => void | Promise<void>;

export type SectionHomeworkAuditLookup = (
  homeworkId: string,
) => SectionHomeworkAuditLog[];
