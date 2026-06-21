import { homeworkDateError } from "@/features/homeworks/server/homework-dates";
import { buildHomeworkUpdateIntent } from "@/features/homeworks/server/homework-update-intent";
import type { AppLocale } from "@/i18n/config";
import {
  jsonToolResult,
  parseOptionalFieldDate,
  type resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

export type UpdateHomeworkOnSectionArgs = {
  homeworkId: string;
  title?: string;
  description?: string | null;
  isMajor?: boolean;
  requiresTeam?: boolean;
  publishedAt?: string | null;
  submissionStartAt?: string | null;
  submissionDueAt?: string | null;
  locale: AppLocale;
  mode?: Parameters<typeof resolveMcpMode>[0];
};

type HomeworkUpdateDateInputs = Pick<
  UpdateHomeworkOnSectionArgs,
  "publishedAt" | "submissionDueAt" | "submissionStartAt"
>;

type HomeworkUpdateScalarInputs = Pick<
  UpdateHomeworkOnSectionArgs,
  "isMajor" | "requiresTeam" | "title"
>;

type ParsedHomeworkUpdateDates = {
  hasPublishedAt: boolean;
  hasSubmissionDueAt: boolean;
  hasSubmissionStartAt: boolean;
  publishedAt: Date | null | undefined;
  submissionDueAt: Date | null | undefined;
  submissionStartAt: Date | null | undefined;
};

export function parseHomeworkUpdateDates(
  { publishedAt, submissionDueAt, submissionStartAt }: HomeworkUpdateDateInputs,
  mode: ReturnType<typeof resolveMcpMode>,
) {
  const hasPublishedAt = publishedAt !== undefined;
  const hasSubmissionStartAt = submissionStartAt !== undefined;
  const hasSubmissionDueAt = submissionDueAt !== undefined;

  const parsedPublishedAt = parseOptionalFieldDate(
    "publishedAt",
    publishedAt,
    hasPublishedAt,
  );
  if (!parsedPublishedAt.ok) {
    return parsedPublishedAt;
  }
  const parsedSubmissionStartAt = parseOptionalFieldDate(
    "submissionStartAt",
    submissionStartAt,
    hasSubmissionStartAt,
  );
  if (!parsedSubmissionStartAt.ok) {
    return parsedSubmissionStartAt;
  }
  const parsedSubmissionDueAt = parseOptionalFieldDate(
    "submissionDueAt",
    submissionDueAt,
    hasSubmissionDueAt,
  );
  if (!parsedSubmissionDueAt.ok) {
    return parsedSubmissionDueAt;
  }
  const dateError = homeworkDateError({
    publishedAt: parsedPublishedAt.value,
    publishedAtProvided: hasPublishedAt,
    submissionDueAt: parsedSubmissionDueAt.value,
    submissionDueAtProvided: hasSubmissionDueAt,
    submissionStartAt: parsedSubmissionStartAt.value,
    submissionStartAtProvided: hasSubmissionStartAt,
  });
  if (dateError) {
    return {
      ok: false as const,
      result: jsonToolResult({ success: false, message: dateError }, { mode }),
    };
  }

  return {
    ok: true as const,
    value: {
      hasPublishedAt,
      hasSubmissionDueAt,
      hasSubmissionStartAt,
      publishedAt: parsedPublishedAt.value,
      submissionDueAt: parsedSubmissionDueAt.value,
      submissionStartAt: parsedSubmissionStartAt.value,
    },
  };
}

export function buildHomeworkUpdateIntentForTool(
  { isMajor, requiresTeam, title }: HomeworkUpdateScalarInputs,
  userId: string,
  dates: ParsedHomeworkUpdateDates,
  description?: string | null,
) {
  return buildHomeworkUpdateIntent({
    dates,
    description,
    hasDescription: description !== undefined,
    isMajor,
    requiresTeam,
    title,
    userId,
  });
}
