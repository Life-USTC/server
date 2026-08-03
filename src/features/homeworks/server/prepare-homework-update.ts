import { homeworkDateError } from "@/features/homeworks/server/homework-dates";
import {
  buildHomeworkUpdateIntent,
  type HomeworkUpdateIntent,
  hasHomeworkUpdateIntentChanges,
} from "@/features/homeworks/server/homework-update-intent";

type HomeworkUpdateDates = {
  hasPublishedAt: boolean;
  hasSubmissionDueAt: boolean;
  hasSubmissionStartAt: boolean;
  publishedAt: Date | null | undefined;
  submissionDueAt: Date | null | undefined;
  submissionStartAt: Date | null | undefined;
};

export type PrepareHomeworkUpdateInput = {
  dates: HomeworkUpdateDates;
  description?: string | null;
  hasDescription: boolean;
  isMajor?: boolean | null;
  requiresTeam?: boolean | null;
  title?: string;
  userId: string;
};

export type PrepareHomeworkUpdateResult =
  | { ok: true; update: HomeworkUpdateIntent }
  | { ok: false; error: "date"; message: string }
  | { ok: false; error: "no_changes" };

export function prepareHomeworkUpdate(
  input: PrepareHomeworkUpdateInput,
): PrepareHomeworkUpdateResult {
  const dateError = homeworkDateError({
    publishedAt: input.dates.publishedAt,
    publishedAtProvided: input.dates.hasPublishedAt,
    submissionDueAt: input.dates.submissionDueAt,
    submissionDueAtProvided: input.dates.hasSubmissionDueAt,
    submissionStartAt: input.dates.submissionStartAt,
    submissionStartAtProvided: input.dates.hasSubmissionStartAt,
  });
  if (dateError) {
    return { ok: false, error: "date", message: dateError };
  }

  const update = buildHomeworkUpdateIntent({
    dates: input.dates,
    description: input.description,
    hasDescription: input.hasDescription,
    isMajor: input.isMajor,
    requiresTeam: input.requiresTeam,
    title: input.title,
    userId: input.userId,
  });

  if (!hasHomeworkUpdateIntentChanges(update)) {
    return { ok: false, error: "no_changes" };
  }

  return { ok: true, update };
}
