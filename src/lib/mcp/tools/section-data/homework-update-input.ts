import type { Prisma } from "@/generated/prisma/client";
import {
  parseOptionalFieldDate,
  type resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { invalidSubmissionWindow } from "./homework-tool-helpers";

export type UpdateHomeworkOnSectionArgs = {
  homeworkId: string;
  title?: string;
  description?: string | null;
  isMajor?: boolean;
  requiresTeam?: boolean;
  publishedAt?: string | null;
  submissionStartAt?: string | null;
  submissionDueAt?: string | null;
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
  const submissionWindowError = invalidSubmissionWindow(
    parsedSubmissionStartAt.value,
    parsedSubmissionDueAt.value,
  );
  if (submissionWindowError) {
    return { ok: false as const, result: submissionWindowError };
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

export function buildHomeworkUpdates(
  { isMajor, requiresTeam, title }: HomeworkUpdateScalarInputs,
  userId: string,
  dates: ParsedHomeworkUpdateDates,
) {
  const updates: Prisma.HomeworkUncheckedUpdateInput = {
    updatedById: userId,
  };
  if (title !== undefined) updates.title = title;
  if (isMajor !== undefined) updates.isMajor = isMajor === true;
  if (requiresTeam !== undefined) updates.requiresTeam = requiresTeam === true;
  if (dates.hasPublishedAt) updates.publishedAt = dates.publishedAt;
  if (dates.hasSubmissionStartAt)
    updates.submissionStartAt = dates.submissionStartAt;
  if (dates.hasSubmissionDueAt) updates.submissionDueAt = dates.submissionDueAt;
  return updates;
}
