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

  test("更新提交窗口使用共享的作业日期规则", () => {
    const result = parseHomeworkUpdateDates(
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
});
