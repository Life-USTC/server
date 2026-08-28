import type {
  HomeworkFormCopy,
  HomeworkTagCopy,
  HomeworkTimestampCopy,
} from "@/features/homeworks/components/homework-form-types";

export type SectionCreateHomeworkFieldsCopy = HomeworkFormCopy &
  HomeworkTagCopy &
  HomeworkTimestampCopy & {
    helperSemesterStart: string;
    sectionLabel: string;
  };

export type SectionCreateHomeworkCopy = SectionCreateHomeworkFieldsCopy & {
  auditTitle: string;
  createAction: string;
  createTitle: string;
  subtitle: string;
};

export type SectionCreateHomeworkCommentsCopy = {
  markdownGuide: string;
  previewEmpty: string;
  tabPreview: string;
  tabWrite: string;
};

export type SectionCreateHomeworkSectionCopy = {
  close?: string;
};
