import { expect, it } from "vitest";
import { getDemoExamsTabData } from "@/features/demo/server/demo-exams";
import {
  getDemoNavigation,
  getDemoWorkspacePage,
} from "@/features/demo/server/demo-workspace";
import { flattenExamRows } from "@/features/workspace/lib/exams";

const identity = {
  fixtureVersion: "workspace-v1" as const,
  expiresAt: 1790212500000,
};
for (const locale of ["zh-cn", "en-us"] as const) {
  it(`shares fixed exams, dates and upcoming navigation in ${locale}`, () => {
    const page = getDemoWorkspacePage(identity, locale, "exams");
    expect(page.subscriptions).toEqual(getDemoExamsTabData(identity, locale));
    expect(page.subscriptions?.calendarSubscriptionUrl).toBeNull();
    expect(page.calendarSubscriptionUrl).toBeNull();
    if (!page.subscriptions)
      throw new Error("Demo exams require subscriptions");
    const rows = flattenExamRows(page.subscriptions, page.referenceNow, {
      dateFallback: "",
      notAvailable: "",
    });
    expect(
      rows.map(({ id, completed, section, startTime, endTime }) => ({
        id,
        completed,
        section: section.jwId,
        startTime,
        endTime,
      })),
    ).toEqual([
      {
        id: 803,
        completed: true,
        section: 910003,
        startTime: 1400,
        endTime: 1600,
      },
      {
        id: 801,
        completed: false,
        section: 910001,
        startTime: 1400,
        endTime: 1600,
      },
      {
        id: 802,
        completed: false,
        section: 910002,
        startTime: 1400,
        endTime: 1600,
      },
    ]);
    expect(rows.map(({ examDate }) => examDate)).toEqual([
      "2026-06-26T00:00:00+08:00",
      "2027-01-08T00:00:00+08:00",
      "2027-01-08T00:00:00+08:00",
    ]);
    expect(rows.map(({ courseName }) => courseName)).toEqual(
      locale === "en-us"
        ? ["Data Structures", "Linear Algebra", "College Physics"]
        : ["数据结构", "线性代数", "大学物理"],
    );
    expect(getDemoNavigation(identity).examsCount).toBe(2);
    page.subscriptions.subscriptions[0].sections[0].exams.length = 0;
    expect(
      getDemoExamsTabData(identity, locale).subscriptions[0].sections[0].exams,
    ).toHaveLength(1);
  });
}
