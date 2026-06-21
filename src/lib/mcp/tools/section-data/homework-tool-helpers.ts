import { jsonToolResult } from "@/lib/mcp/tools/_helpers";

export function invalidSubmissionWindow(
  submissionStartAt: Date | null | undefined,
  submissionDueAt: Date | null | undefined,
) {
  if (
    submissionStartAt &&
    submissionDueAt &&
    submissionStartAt.getTime() > submissionDueAt.getTime()
  ) {
    return jsonToolResult(
      { success: false, message: "Submission start must be before due" },
      { mode: "default" },
    );
  }

  return null;
}
