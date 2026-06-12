export type SectionCreateHomeworkFieldsCopy = {
  descriptionLabel: string;
  descriptionPlaceholder: string;
  helperClear: string;
  helperMonth: string;
  helperPublishNow: string;
  helperSemesterEnd: string;
  helperSemesterStart: string;
  helperStartNow: string;
  helperWeek: string;
  publishedAt: string;
  submissionDue: string;
  submissionStart: string;
  tagMajor: string;
  tagTeam: string;
  titleLabel: string;
  titlePlaceholder: string;
};

export type SectionCreateHomeworkCopy = SectionCreateHomeworkFieldsCopy & {
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
