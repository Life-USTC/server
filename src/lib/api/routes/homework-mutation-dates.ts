import { parseDateInput } from "@/lib/time/parse-date-input";

export function parseHomeworkDateInput(value: string | null | undefined) {
  return parseDateInput(value);
}

export function homeworkDateError(input: {
  publishedAt: Date | null | undefined;
  publishedAtProvided?: boolean;
  submissionDueAt: Date | null | undefined;
  submissionDueAtProvided?: boolean;
  submissionStartAt: Date | null | undefined;
  submissionStartAtProvided?: boolean;
}) {
  if (input.publishedAtProvided !== false && input.publishedAt === undefined) {
    return "Invalid publish date";
  }
  if (
    input.submissionStartAtProvided !== false &&
    input.submissionStartAt === undefined
  ) {
    return "Invalid submission start";
  }
  if (
    input.submissionDueAtProvided !== false &&
    input.submissionDueAt === undefined
  ) {
    return "Invalid submission due";
  }

  if (
    input.submissionStartAt &&
    input.submissionDueAt &&
    input.submissionStartAt.getTime() > input.submissionDueAt.getTime()
  ) {
    return "Submission start must be before due";
  }

  return "";
}
