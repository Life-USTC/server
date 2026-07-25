import { describe, expect, it } from "vitest";
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { createHomeworkTabDisplayActions } from "@/features/dashboard/lib/homeworks-tab-display";

const referenceDate = "2026-05-22T10:30:00+08:00";

function buildActions(locale = "zh-cn") {
  return createHomeworkTabDisplayActions({
    dashboardCopy: {} as DashboardDashboardCopy,
    homeworkCopy: { section: "Section" },
    homeworksCopy: { markComplete: "完成", markIncomplete: "取消完成" },
    locale,
    referenceDate,
    sectionCopy: { dateTBD: "待定" } as DashboardSectionCopy,
  });
}

describe("仪表盘作业逾期展示", () => {
  it("将已过截止时间的作业标记为逾期", () => {
    const { homeworkIsOverdue, homeworkEtaLabel } = buildActions();

    expect(homeworkIsOverdue("2026-05-22T10:30:00+08:00")).toBe(true);
    expect(homeworkIsOverdue("2026-05-21T23:59:00+08:00")).toBe(true);
    expect(homeworkEtaLabel("2026-05-21T23:59:00+08:00")).toBe("已逾期");
  });

  it("未逾期的截止时间保持普通样式", () => {
    const { homeworkIsOverdue } = buildActions();

    expect(homeworkIsOverdue("2026-05-22T10:31:00+08:00")).toBe(false);
    expect(homeworkIsOverdue("2026-06-01T00:00:00+08:00")).toBe(false);
  });

  it("缺失截止时间不视为逾期", () => {
    const { homeworkIsOverdue } = buildActions();

    expect(homeworkIsOverdue(null)).toBe(false);
    expect(homeworkIsOverdue(undefined)).toBe(false);
  });

  it("英文区域同样标记逾期", () => {
    const { homeworkIsOverdue, homeworkEtaLabel } = buildActions("en-us");

    expect(homeworkIsOverdue("2026-05-21T23:59:00+08:00")).toBe(true);
    expect(homeworkEtaLabel("2026-05-21T23:59:00+08:00")).toBe("Overdue");
  });
});
