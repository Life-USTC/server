import { homeworkDateError } from "@/features/homeworks/server/homework-dates";
import {
  jsonToolResult,
  parseOptionalFieldDate,
  type resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

export { createHomeworkOnSectionRecord } from "./homework-create-record";

type McpMode = ReturnType<typeof resolveMcpMode>;

export function parseCreateHomeworkTimestamps(
  input: {
    publishedAt?: string | null;
    submissionDueAt?: string | null;
    submissionStartAt?: string | null;
  },
  mode: McpMode,
) {
  const parsedPublishedAt = parseOptionalFieldDate(
    "publishedAt",
    input.publishedAt,
  );
  if (!parsedPublishedAt.ok) {
    return parsedPublishedAt;
  }

  const parsedSubmissionStartAt = parseOptionalFieldDate(
    "submissionStartAt",
    input.submissionStartAt,
  );
  if (!parsedSubmissionStartAt.ok) {
    return parsedSubmissionStartAt;
  }

  const parsedSubmissionDueAt = parseOptionalFieldDate(
    "submissionDueAt",
    input.submissionDueAt,
  );
  if (!parsedSubmissionDueAt.ok) {
    return parsedSubmissionDueAt;
  }

  const dateError = homeworkDateError({
    publishedAt: parsedPublishedAt.value,
    submissionDueAt: parsedSubmissionDueAt.value,
    submissionStartAt: parsedSubmissionStartAt.value,
  });
  if (dateError) {
    return {
      ok: false as const,
      result: jsonToolResult({ success: false, message: dateError }, { mode }),
    };
  }

  return {
    ok: true as const,
    publishedAt: parsedPublishedAt.value,
    submissionDueAt: parsedSubmissionDueAt.value,
    submissionStartAt: parsedSubmissionStartAt.value,
  };
}
