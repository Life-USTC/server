import { findActiveSuspension } from "@/lib/auth/viewer-context";
import {
  jsonToolResult,
  parseOptionalFieldDate,
  type resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { invalidSubmissionWindow } from "./homework-tool-helpers";

export { createHomeworkOnSectionRecord } from "./homework-create-record";

type McpMode = ReturnType<typeof resolveMcpMode>;

export async function suspendedCreateHomeworkResult(
  userId: string,
  mode: McpMode,
) {
  const suspension = await findActiveSuspension(userId);
  if (!suspension) return null;

  return jsonToolResult(
    {
      success: false,
      message: "Suspended",
      reason: suspension.reason ?? null,
    },
    { mode },
  );
}

export function parseCreateHomeworkTimestamps(input: {
  publishedAt?: string | null;
  submissionDueAt?: string | null;
  submissionStartAt?: string | null;
}) {
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

  const submissionWindowError = invalidSubmissionWindow(
    parsedSubmissionStartAt.value,
    parsedSubmissionDueAt.value,
  );
  if (submissionWindowError) {
    return { ok: false as const, result: submissionWindowError };
  }

  return {
    ok: true as const,
    publishedAt: parsedPublishedAt.value,
    submissionDueAt: parsedSubmissionDueAt.value,
    submissionStartAt: parsedSubmissionStartAt.value,
  };
}
