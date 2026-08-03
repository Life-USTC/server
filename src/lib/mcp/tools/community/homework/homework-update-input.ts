import type { AppLocale } from "@/i18n/config";
import {
  jsonToolResult,
  parseOptionalFieldDate,
  type resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";

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

/**
 * Coerces the three optional date args into the shape
 * `prepareHomeworkUpdate` expects. Cross-field validation lives there, so this
 * only reports strings it could not parse at all.
 */
export function parseHomeworkUpdateDates({
  publishedAt,
  submissionDueAt,
  submissionStartAt,
}: HomeworkUpdateDateInputs) {
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

export function homeworkUpdateToolFailure(
  message: string,
  mode: ReturnType<typeof resolveMcpMode>,
) {
  return jsonToolResult({ success: false, message }, { mode });
}
