import { describe, expect, test } from "vitest";
import { prepareHomeworkUpdate } from "@/features/homeworks/server/prepare-homework-update";
import { parseCreateHomeworkTimestamps } from "@/lib/mcp/tools/community/homework/homework-create-actions";
import { parseHomeworkUpdateDates } from "@/lib/mcp/tools/community/homework/homework-update-input";

function parseToolPayload(result: {
  content: Array<{ text: string; type: "text" }>;
}) {
  return JSON.parse(result.content[0]?.text ?? "{}") as {
    message?: string;
    success?: boolean;
  };
}

describe("MCP 作业日期解析", () => {
  test("创建提交窗口使用共享的作业日期规则", () => {
    const result = parseCreateHomeworkTimestamps(
      {
        submissionDueAt: "2026-04-01T00:00:00Z",
        submissionStartAt: "2026-04-02T00:00:00Z",
      },
      "full",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(parseToolPayload(result.result)).toEqual({
      message: "Submission start must be before due",
      success: false,
    });
  });

  // Cross-field ordering now lives in `prepareHomeworkUpdate`, which all three
  // surfaces call; MCP only coerces the strings.
  test("更新提交窗口使用共享的作业日期规则", () => {
    const parsedDates = parseHomeworkUpdateDates({
      submissionDueAt: "2026-04-01T00:00:00Z",
      submissionStartAt: "2026-04-02T00:00:00Z",
    });

    expect(parsedDates.ok).toBe(true);
    if (!parsedDates.ok) return;

    const prepared = prepareHomeworkUpdate({
      dates: parsedDates.value,
      hasDescription: false,
      userId: "user-1",
    });

    expect(prepared).toEqual({
      error: "date",
      message: "Submission start must be before due",
      ok: false,
    });
  });
});
