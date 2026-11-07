import { describe, expect, it } from "vitest";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  getDefaultWeekRange,
  getDefaultWeekStart,
  isSameDefaultWeek,
} from "@/shared/lib/date-utils";

describe("默认周辅助函数", () => {
  it("以周日作为共享周边界", () => {
    const date = shanghaiDayjs("2026-03-18T10:00:00+08:00");

    expect(getDefaultWeekStart(date).format("YYYY-MM-DD")).toBe("2026-03-15");
  });

  it("将下一个周日划入新的共享周", () => {
    const ref = shanghaiDayjs("2026-03-16T10:00:00+08:00");
    const due = shanghaiDayjs("2026-03-22T09:00:00+08:00");

    expect(isSameDefaultWeek(ref, due)).toBe(false);
  });

  it("将起始周日保留在共享周内", () => {
    const ref = shanghaiDayjs("2026-03-18T10:00:00+08:00");
    const due = shanghaiDayjs("2026-03-15T09:00:00+08:00");
    const { start, endExclusive } = getDefaultWeekRange(ref);

    expect(isSameDefaultWeek(ref, due)).toBe(true);
    expect(due.isBefore(start)).toBe(false);
    expect(due.isBefore(endExclusive)).toBe(true);
  });
  it("按上海周六午夜切换周日边界并保留七日半开区间", () => {
    const before = shanghaiDayjs("2026-08-29T15:59:59Z");
    const after = shanghaiDayjs("2026-08-29T16:00:00Z");
    expect(getDefaultWeekStart(before).format("YYYY-MM-DD")).toBe("2026-08-23");
    const { start, endExclusive } = getDefaultWeekRange(after);
    expect(start.format("YYYY-MM-DD HH:mm")).toBe("2026-08-30 00:00");
    expect(endExclusive.format("YYYY-MM-DD HH:mm")).toBe("2026-09-06 00:00");
    expect(isSameDefaultWeek(after, endExclusive.subtract(1, "second"))).toBe(
      true,
    );
    expect(isSameDefaultWeek(after, endExclusive)).toBe(false);
  });
});
