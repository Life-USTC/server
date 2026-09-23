import { ICalCalendar } from "ical-generator";
import { describe, expect, it } from "vitest";
import { createExamEvent } from "@/features/calendar/server/ical-section-exam-event";
import { createScheduleEvent } from "@/features/calendar/server/ical-section-schedule-event";
import type { RoomMapAssets } from "@/features/rooms/server/room-map-service";

const assets: RoomMapAssets = {
  manifest: {
    rooms: ["3A204", "3A205"].map((code) => ({
      code,
      building: "第三教学楼",
      floor: "2",
      imagePath: `imgs/rooms/${code}.png`,
      sourceImagePath: "imgs/三教主_02.png",
    })),
  },
  rules: [{ regex: "3[AB]2\\d{2}", path: "./imgs/三教主_02.png" }],
};
const section = {
  code: "TEST.01",
  course: { nameCn: "测试课程", code: "TEST" },
} as Parameters<typeof createExamEvent>[1];
const geo = { locations: [] };
function exam(rooms: string[]) {
  return {
    id: 1,
    examDate: new Date("2026-09-11T00:00:00Z"),
    startTime: 900,
    endTime: 1100,
    examType: 2,
    examRooms: rooms.map((room) => ({ room })),
  } as Parameters<typeof createExamEvent>[0];
}
function unfolded(calendar: ICalCalendar) {
  return calendar.toString().replace(/\r\n[ \t]/g, "");
}
describe("iCalendar room maps", () => {
  it("attaches each distinct exam map and keeps labeled links in DESCRIPTION", () => {
    const calendar = new ICalCalendar();
    createExamEvent(
      exam(["3A204", "3A205", "3A204", "UNKNOWN"]),
      section,
      calendar,
      geo,
      assets,
      "en-us",
    );
    const output = unfolded(calendar);
    expect(output.match(/^ATTACH[^\r\n]+/gm)).toEqual([
      "ATTACH:https://static.life-ustc.tiankaima.dev/imgs/rooms/3A204.png",
      "ATTACH:https://static.life-ustc.tiankaima.dev/imgs/rooms/3A205.png",
    ]);
    expect(output).toContain("Room map: 3A204: https://");
    expect(output).toContain("Room map: 3A205: https://");
  });
  it("retains events with unknown or free-text locations and deduplicates overview images", () => {
    const calendar = new ICalCalendar();
    createExamEvent(
      exam(["UNKNOWN", "地点待定"]),
      section,
      calendar,
      geo,
      assets,
      "zh-cn",
    );
    expect(calendar.events()).toHaveLength(1);
    expect(unfolded(calendar)).not.toContain("ATTACH:");
    createExamEvent(
      exam(["3B201", "3B202"]),
      section,
      calendar,
      geo,
      assets,
      "zh-cn",
    );
    expect(unfolded(calendar).match(/^ATTACH[^\r\n]+/gm)).toHaveLength(1);
  });
  it("attaches the highlighted course room and preserves event identity", () => {
    const calendar = new ICalCalendar();
    const schedule = {
      id: 7,
      date: new Date("2026-09-11T00:00:00Z"),
      startTime: 800,
      endTime: 945,
      room: {
        code: "3A204",
        nameCn: "3A204",
        building: { nameCn: "三教", campus: { nameCn: "西区" } },
      },
      teachers: [],
    } as unknown as Parameters<typeof createScheduleEvent>[0];
    createScheduleEvent(schedule, section, calendar, geo, assets, "zh-cn");
    const output = unfolded(calendar);
    expect(output).toContain(
      "ATTACH:https://static.life-ustc.tiankaima.dev/imgs/rooms/3A204.png",
    );
    expect(output).toContain("教室地图：3A204: https://");
    expect(output).toContain("/schedule/7");
  });
});
