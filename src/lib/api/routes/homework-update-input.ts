import {
  homeworkDateError,
  parseHomeworkDateInput,
} from "@/features/homeworks/server/homework-dates";
import {
  buildHomeworkUpdateIntent,
  hasHomeworkUpdateIntentChanges,
} from "@/features/homeworks/server/homework-update-intent";
import { badRequest } from "@/lib/api/helpers";

export function parseUpdateHomeworkInput(
  parsedBody: {
    description?: string | null;
    isMajor?: boolean | null;
    publishedAt?: string | null;
    requiresTeam?: boolean | null;
    submissionDueAt?: string | null;
    submissionStartAt?: string | null;
    title?: string;
  },
  userId: string,
) {
  const title = parsedBody.title;
  const hasDescription = Object.hasOwn(parsedBody, "description");
  const hasPublishedAt = Object.hasOwn(parsedBody, "publishedAt");
  const hasSubmissionStartAt = Object.hasOwn(parsedBody, "submissionStartAt");
  const hasSubmissionDueAt = Object.hasOwn(parsedBody, "submissionDueAt");

  const publishedAt = hasPublishedAt
    ? parseHomeworkDateInput(parsedBody.publishedAt)
    : undefined;
  const submissionStartAt = hasSubmissionStartAt
    ? parseHomeworkDateInput(parsedBody.submissionStartAt)
    : undefined;
  const submissionDueAt = hasSubmissionDueAt
    ? parseHomeworkDateInput(parsedBody.submissionDueAt)
    : undefined;

  const dateError = homeworkDateError({
    publishedAt,
    publishedAtProvided: hasPublishedAt,
    submissionDueAt,
    submissionDueAtProvided: hasSubmissionDueAt,
    submissionStartAt,
    submissionStartAtProvided: hasSubmissionStartAt,
  });
  if (dateError) return badRequest(dateError);

  const update = buildHomeworkUpdateIntent({
    dates: {
      hasPublishedAt,
      hasSubmissionDueAt,
      hasSubmissionStartAt,
      publishedAt,
      submissionDueAt,
      submissionStartAt,
    },
    description: parsedBody.description,
    hasDescription,
    isMajor: parsedBody.isMajor,
    requiresTeam: parsedBody.requiresTeam,
    title,
    userId,
  });

  return hasHomeworkUpdateIntentChanges(update)
    ? update
    : badRequest("No changes");
}
