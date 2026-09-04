import { describe, expect, it } from "vitest";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  getDefaultWeekRange,
  getDefaultWeekStart,
  isSameDefaultWeek,
} from "@/shared/lib/date-utils";

describe("默认周辅助函数", () => {
  it("以周一作为共享周边界", () => {
    const date = shanghaiDayjs("2026-03-18T10:00:00+08:00");

    expect(getDefaultWeekStart(date).format("YYYY-MM-DD")).toBe("2026-03-16");
  });

  it("将下一个周日保留在同一共享周内", () => {
    const ref = shanghaiDayjs("2026-03-16T10:00:00+08:00");
    const due = shanghaiDayjs("2026-03-22T09:00:00+08:00");

    expect(isSameDefaultWeek(ref, due)).toBe(true);
  });

  it("将上一个周日排除在共享周之外", () => {
    const ref = shanghaiDayjs("2026-03-18T10:00:00+08:00");
    const due = shanghaiDayjs("2026-03-15T09:00:00+08:00");
    const { start, endExclusive } = getDefaultWeekRange(ref);

    expect(isSameDefaultWeek(ref, due)).toBe(false);
    expect(due.isBefore(start)).toBe(true);
    expect(due.isBefore(endExclusive)).toBe(true);
  });
});
