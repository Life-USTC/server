import { parseHomeworkDateInput } from "@/features/homeworks/server/homework-dates";
import { prepareHomeworkUpdate } from "@/features/homeworks/server/prepare-homework-update";
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
  const hasDescription = Object.hasOwn(parsedBody, "description");
  const hasPublishedAt = Object.hasOwn(parsedBody, "publishedAt");
  const hasSubmissionStartAt = Object.hasOwn(parsedBody, "submissionStartAt");
  const hasSubmissionDueAt = Object.hasOwn(parsedBody, "submissionDueAt");

  const prepared = prepareHomeworkUpdate({
    dates: {
      hasPublishedAt,
      hasSubmissionDueAt,
      hasSubmissionStartAt,
      publishedAt: hasPublishedAt
        ? parseHomeworkDateInput(parsedBody.publishedAt)
        : undefined,
      submissionDueAt: hasSubmissionDueAt
        ? parseHomeworkDateInput(parsedBody.submissionDueAt)
        : undefined,
      submissionStartAt: hasSubmissionStartAt
        ? parseHomeworkDateInput(parsedBody.submissionStartAt)
        : undefined,
    },
    description: parsedBody.description,
    hasDescription,
    isMajor: parsedBody.isMajor,
    requiresTeam: parsedBody.requiresTeam,
    title: parsedBody.title,
    userId,
  });

  if (!prepared.ok) {
    return badRequest(
      prepared.error === "no_changes" ? "No changes" : prepared.message,
    );
  }

  return prepared.update;
}
