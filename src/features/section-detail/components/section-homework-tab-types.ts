export type HomeworkView = "cards" | "list";

export type SectionHomework = {
  completion: { completedAt: string | null } | null;
  completionRequired?: boolean;
  description?: { content?: string | null } | null;
  id: string;
  isMajor: boolean;
  publishedAt?: Date | string | null;
  requiresTeam: boolean;
  submissionDueAt: Date | string | null;
  submissionStartAt?: Date | string | null;
  title: string;
};

export type SectionHomeworkCopy = {
  auditTitle: string;
  loginToCreate: string;
  noCompletionRequired: string;
  showCreate: string;
  tagMajor: string;
  tagTeam: string;
};

export type SectionCopy = {
  cardsView: string;
  due: string;
  flags: string;
  homeworkView: string;
  listView: string;
  noHomework: string;
  title: string;
};
