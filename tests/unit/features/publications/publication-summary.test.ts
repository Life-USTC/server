import { describe, expect, it } from "vitest";
import {
  publicationListSummary,
  publicationListSummaryIsUrlHeavy,
  publicationSummary,
} from "@/features/publications/lib/publication-summary";

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

  it("truncates long URL-like list summaries and marks them for one-line clamp", () => {
    const longUrl = `https://example.test/${"a".repeat(200)}`;
    const summary = `查看报名要求：${longUrl}`;
    const listed = publicationListSummary("校园通知", summary);
    expect(listed).toContain("查看报名要求：");
    expect(listed.length).toBeLessThan(summary.length);
    expect(listed).toMatch(/…$/u);
    expect(publicationListSummaryIsUrlHeavy(listed)).toBe(true);
    expect(publicationListSummary("校园通知", "校园通知补充说明")).toBe(
      "校园通知补充说明",
    );
    expect(publicationListSummaryIsUrlHeavy("校园通知补充说明")).toBe(false);
  });
});
