import { describe, expect, it } from "vitest";
import { publicationSummary } from "@/features/publications/lib/publication-summary";

describe("publicationSummary", () => {
  it.each([
    null,
    undefined,
    "",
    " \n ",
    "https://news.example.test/entry",
    "校园 通知。",
  ])(
    "suppresses empty, URL-only and duplicate-title summaries: %s",
    (summary) => {
      expect(publicationSummary("校园通知", summary)).toBe("");
    },
  );

  it("keeps useful summaries, including descriptions containing a long URL", () => {
    const summary = `查看报名要求：https://example.test/${"a".repeat(200)}`;
    expect(publicationSummary("校园通知", summary)).toBe(summary);
    expect(publicationSummary("校园通知", "校园通知补充说明")).toBe(
      "校园通知补充说明",
    );
  });

  it("avoids repeating the body lead in a detail header", () => {
    expect(
      publicationSummary(
        "校园通知",
        "报名于周五开始。",
        "报名于周五开始。\n\n请携带证件。",
      ),
    ).toBe("");
    expect(
      publicationSummary(
        "校园通知",
        "报名于周五开始。",
        "## 报名要求\n\n请携带证件。",
      ),
    ).toBe("报名于周五开始。");
  });
});
