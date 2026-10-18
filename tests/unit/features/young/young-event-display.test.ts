import { describe, expect, it } from "vitest";
import {
  groupYoungEventsByStartDate,
  youngCapacity,
  youngClockTime,
  youngDateRange,
  youngDateTime,
  youngDetailFacts,
  youngEventStatusLabel,
  youngListDayLabel,
  youngListMetaBadges,
  youngListTimeLabel,
  youngMonthDay,
} from "@/features/young/lib/young-event-display";

const copy = { startsAt: "开始：{value}", endsAt: "截止：{value}" };

describe("young event display", () => {
  it("distinguishes unknown occupancy from a known zero", () => {
    expect(youngCapacity(null, 20, "未提供")).toBe("未提供 / 20");
    expect(youngCapacity(0, 20, "未提供")).toBe("0 / 20");
    expect(youngCapacity(null, null, "未提供")).toBe("未提供");
    expect(youngCapacity(7, null, "未提供")).toBe("7");
    expect(youngCapacity(0, 0, "未提供")).toBe("0 / 0");
  });

  it("renders UTC instants and upstream local venue times in Shanghai", () => {
    expect(youngDateTime("2026-09-24T00:30:00Z")).toBe("2026-09-24 08:30");
    expect(youngDateTime("2026-09-24 08:30:00")).toBe("2026-09-24 08:30");
    expect(youngDateTime(null)).toBeNull();
  });

  it("groups a page into Shanghai start dates and keeps a short clock", () => {
    expect(youngClockTime("2026-10-16T12:30:00+08:00")).toBe("12:30");
    expect(youngMonthDay("2026-10-16T12:30:00+08:00")).toBe("10-16");
    expect(youngListDayLabel("", "zh-cn", "时间待公布")).toBe("时间待公布");
    const groups = groupYoungEventsByStartDate([
      { startAt: "2026-09-28T12:20:00+08:00", name: "later" },
      { startAt: "2026-09-27T20:00:00+08:00", name: "evening" },
      { startAt: "2026-09-27T15:00:00+08:00", name: "afternoon" },
      { startAt: null, name: "unknown" },
    ]);
    expect(groups.map((group) => group.key)).toEqual([
      "2026-09-27",
      "2026-09-28",
      "",
    ]);
    expect(groups[0]?.events.map((event) => event.name)).toEqual([
      "afternoon",
      "evening",
    ]);
  });

  it("young-event.web-list-scan", () => {
    const groups = groupYoungEventsByStartDate([
      { startAt: "2026-09-28T12:20:00+08:00", name: "later" },
      { startAt: "2026-09-27T20:00:00+08:00", name: "evening" },
      { startAt: "2026-09-27T15:00:00+08:00", name: "afternoon" },
      { startAt: null, name: "unknown" },
    ]);
    expect(groups.map((group) => group.key)).toEqual([
      "2026-09-27",
      "2026-09-28",
      "",
    ]);
    expect(groups.find((group) => group.key === "")?.events).toEqual([
      { startAt: null, name: "unknown" },
    ]);
    expect(
      youngListMetaBadges(["德", "校级", "主办方", "体", "德"], 3),
    ).toEqual({
      visible: ["德", "校级", "主办方"],
      overflow: 1,
    });
    expect(
      youngEventStatusLabel(
        { status: null, isActive: true },
        { statusOpen: "报名中", statusClosed: "已结束" },
      ),
    ).toBe("报名中");
    expect(
      youngEventStatusLabel(
        { status: " 进行中 ", isActive: false },
        { statusOpen: "报名中", statusClosed: "已结束" },
      ),
    ).toBe("进行中");
    expect(
      youngListTimeLabel(null, true, {
        unknownTime: "时间待公布",
        unknownValue: "未提供",
      }),
    ).toBe("时间待公布");
    expect(
      youngListTimeLabel(null, false, {
        unknownTime: "时间待公布",
        unknownValue: "未提供",
      }),
    ).toBe("未提供");
    expect(
      youngDetailFacts({
        time: "2026-09-27 15:00–16:00",
        place: "东区",
        hours: 2.5,
        capacity: "3 / 20",
        deadline: "2026-09-20 12:00",
      }),
    ).toEqual([
      "2026-09-27 15:00–16:00",
      "东区",
      "2.5",
      "3 / 20",
      "2026-09-20 12:00",
    ]);
  });

  it("labels partial ranges rather than presenting a missing endpoint as a date", () => {
    expect(youngDateRange(null, null, copy)).toBeNull();
    expect(youngDateRange("2026-09-24T08:30:00+08:00", null, copy)).toBe(
      "开始：2026-09-24 08:30",
    );
    expect(youngDateRange(null, "2026-09-24T09:30:00+08:00", copy)).toBe(
      "截止：2026-09-24 09:30",
    );
    expect(
      youngDateRange("2026-09-24 08:30:00", "2026-09-24 09:30:00", copy),
    ).toBe("2026-09-24 08:30–09:30");
  });
});
