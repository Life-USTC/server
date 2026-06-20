import type { Prisma } from "@/generated/prisma/client";

export type HomeworkUpdateIntent = {
  description?: string | null;
  homeworkUpdates?: Prisma.HomeworkUpdateInput;
};

type HomeworkUpdateDates = {
  hasPublishedAt: boolean;
  hasSubmissionDueAt: boolean;
  hasSubmissionStartAt: boolean;
  publishedAt: Date | null | undefined;
  submissionDueAt: Date | null | undefined;
  submissionStartAt: Date | null | undefined;
};

export function buildHomeworkUpdateIntent(input: {
  dates: HomeworkUpdateDates;
  description?: string | null;
  hasDescription: boolean;
  isMajor?: boolean | null;
  requiresTeam?: boolean | null;
  title?: string;
  userId: string;
}): HomeworkUpdateIntent {
  const homeworkUpdates: Prisma.HomeworkUpdateInput = {};
  let hasHomeworkUpdates = false;

  if (input.title !== undefined) {
    homeworkUpdates.title = input.title;
    hasHomeworkUpdates = true;
  }
  if (input.isMajor !== undefined) {
    homeworkUpdates.isMajor = input.isMajor === true;
    hasHomeworkUpdates = true;
  }
  if (input.requiresTeam !== undefined) {
    homeworkUpdates.requiresTeam = input.requiresTeam === true;
    hasHomeworkUpdates = true;
  }
  if (input.dates.hasPublishedAt) {
    homeworkUpdates.publishedAt = input.dates.publishedAt;
    hasHomeworkUpdates = true;
  }
  if (input.dates.hasSubmissionStartAt) {
    homeworkUpdates.submissionStartAt = input.dates.submissionStartAt;
    hasHomeworkUpdates = true;
  }
  if (input.dates.hasSubmissionDueAt) {
    homeworkUpdates.submissionDueAt = input.dates.submissionDueAt;
    hasHomeworkUpdates = true;
  }
  if (hasHomeworkUpdates) {
    homeworkUpdates.updatedBy = { connect: { id: input.userId } };
  }

  return {
    description: input.hasDescription ? (input.description ?? null) : undefined,
    homeworkUpdates: hasHomeworkUpdates ? homeworkUpdates : undefined,
  };
}

export function hasHomeworkUpdateIntentChanges(intent: HomeworkUpdateIntent) {
  return (
    intent.description !== undefined || intent.homeworkUpdates !== undefined
  );
}
