import { describe, expect, test } from "vitest";
import { parseCreateHomeworkTimestamps } from "@/lib/mcp/tools/section-data/homework-create-actions";
import { parseHomeworkUpdateDates } from "@/lib/mcp/tools/section-data/homework-update-input";

function parseToolPayload(result: {
  content: Array<{ text: string; type: "text" }>;
}) {
  return JSON.parse(result.content[0]?.text ?? "{}") as {
    message?: string;
    success?: boolean;
  };
}

describe("MCP homework date parsing", () => {
  test("uses the shared homework date rule for create submission windows", () => {
    const result = parseCreateHomeworkTimestamps({
      submissionDueAt: "2026-04-01T00:00:00Z",
      submissionStartAt: "2026-04-02T00:00:00Z",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(parseToolPayload(result.result)).toEqual({
      message: "Submission start must be before due",
      success: false,
    });
  });

  test("uses the shared homework date rule for update submission windows", () => {
    const result = parseHomeworkUpdateDates({
      submissionDueAt: "2026-04-01T00:00:00Z",
      submissionStartAt: "2026-04-02T00:00:00Z",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(parseToolPayload(result.result)).toEqual({
      message: "Submission start must be before due",
      success: false,
    });
  });
});
