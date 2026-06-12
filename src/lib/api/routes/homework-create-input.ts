import { badRequest, parseInteger } from "@/lib/api/helpers";
import {
  homeworkDateError,
  parseHomeworkDateInput,
} from "./homework-mutation-dates";

export function parseCreateHomeworkInput(parsedBody: {
  description?: string | null;
  isMajor?: boolean | null;
  publishedAt?: string | null;
  requiresTeam?: boolean | null;
  sectionId: unknown;
  submissionDueAt?: string | null;
  submissionStartAt?: string | null;
  title: string;
}) {
  const sectionId = parseInteger(parsedBody.sectionId);

  if (!sectionId) {
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
    submissionDueAt,
    submissionStartAt,
    title: parsedBody.title,
  };
}
