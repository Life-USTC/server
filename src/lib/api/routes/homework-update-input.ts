import type { Prisma } from "@/generated/prisma/client";
import { badRequest } from "@/lib/api/helpers";
import {
  homeworkDateError,
  parseHomeworkDateInput,
} from "./homework-mutation-dates";

export function parseUpdateHomeworkInput(
  parsedBody: {
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

  const userFieldCount = [
    title !== undefined,
    parsedBody.isMajor !== undefined,
    parsedBody.requiresTeam !== undefined,
    hasPublishedAt,
    hasSubmissionStartAt,
    hasSubmissionDueAt,
  ].filter(Boolean).length;

  if (userFieldCount === 0) {
    return badRequest("No changes");
  }

  const updates: Prisma.HomeworkUpdateInput = {
    updatedBy: { connect: { id: userId } },
  };

  if (title !== undefined) updates.title = title;
  if (parsedBody.isMajor !== undefined) {
    updates.isMajor = parsedBody.isMajor === true;
  }
  if (parsedBody.requiresTeam !== undefined) {
    updates.requiresTeam = parsedBody.requiresTeam === true;
  }
  if (publishedAt !== undefined) updates.publishedAt = publishedAt;
  if (submissionStartAt !== undefined) {
    updates.submissionStartAt = submissionStartAt;
  }
  if (submissionDueAt !== undefined) {
    updates.submissionDueAt = submissionDueAt;
  }

  return updates;
}
