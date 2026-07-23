import { describe, expect, it } from "vitest";
import { groupSubscribedSectionsBySemester } from "@/features/dashboard/lib/subscription-section-utils";

const section = (
  id: number,
  nameCn: string,
  startDate: string | null,
  endDate: string | null,
) => ({
  id,
  semester: { id, nameCn, startDate, endDate },
});

describe("groupSubscribedSectionsBySemester", () => {
  it("orders semester groups from latest to earliest", () => {
    const groups = groupSubscribedSectionsBySemester(
      [
        section(1, "较远的未来学期", "2027-09-01", "2028-01-15"),
        section(2, "当前学期", "2026-02-20", "2026-07-15"),
        section(3, "最近的未来学期", "2026-09-01", "2027-01-15"),
        section(4, "较近的过去学期", "2025-09-01", "2026-01-15"),
      ],
      "未知学期",
    );

    expect(groups.map((group) => group.label)).toEqual([
      "较远的未来学期",
      "最近的未来学期",
      "当前学期",
      "较近的过去学期",
    ]);
  });

  it("keeps unknown semester groups after dated groups", () => {
    const groups = groupSubscribedSectionsBySemester(
      [
        { id: 1, semester: null },
        section(2, "已知学期", "2026-02-20", "2026-07-15"),
      ],
      "未知学期",
    );

    expect(groups.map((group) => group.label)).toEqual([
      "已知学期",
      "未知学期",
    ]);
  });
});
