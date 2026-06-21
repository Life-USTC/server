import {
  homeworkDateError,
  parseHomeworkDateInput,
} from "@/features/homeworks/server/homework-dates";
import { badRequest, parseInteger } from "@/lib/api/helpers";

export function parseCreateHomeworkInput(parsedBody: {
  description?: string | null;
  isMajor?: boolean | null;
  publishedAt?: string | null;
  requiresTeam?: boolean | null;
  sectionId?: unknown;
  sectionJwId?: unknown;
  submissionDueAt?: string | null;
  submissionStartAt?: string | null;
  title: string;
}) {
  const sectionId =
    parsedBody.sectionId == null ? null : parseInteger(parsedBody.sectionId);
  const sectionJwId =
    parsedBody.sectionJwId == null
      ? null
      : parseInteger(parsedBody.sectionJwId);

  if (
    (parsedBody.sectionId != null && !sectionId) ||
    (parsedBody.sectionJwId != null && !sectionJwId) ||
    (!sectionId && !sectionJwId)
  ) {
    return badRequest("Invalid section");
  }

  const publishedAt = parseHomeworkDateInput(parsedBody.publishedAt);
  const submissionStartAt = parseHomeworkDateInput(
    parsedBody.submissionStartAt,
  );
  const submissionDueAt = parseHomeworkDateInput(parsedBody.submissionDueAt);

  const dateError = homeworkDateError({
    publishedAt,
    submissionDueAt,
    submissionStartAt,
  });
  if (dateError) return badRequest(dateError);

  return {
    description: (parsedBody.description ?? "").trim(),
    isMajor: parsedBody.isMajor === true,
    publishedAt,
    requiresTeam: parsedBody.requiresTeam === true,
    sectionId,
    sectionJwId,
    submissionDueAt,
    submissionStartAt,
    title: parsedBody.title,
  };
}
