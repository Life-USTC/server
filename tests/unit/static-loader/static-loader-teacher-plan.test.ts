import { describe, expect, it } from "vitest";
import type { Snapshot } from "@/static-loader/snapshot";
import { loadTeachers } from "@/static-loader/teacher-plan";

describe("static teacher plan", () => {
  it("imports and deduplicates teachers found only in schedule rows", () => {
    const scheduleRows = [
      {
        lessonId: 167345,
        semester_id: 401,
        teacherId: 10915,
        personId: 210065,
        personName: "黄大弘",
      },
      {
        lessonId: 167345,
        semester_id: 401,
        teacherId: 10915,
        personId: 210065,
        personName: "黄大弘",
      },
    ];
    const snapshot = {
      queryAll: (table: string) =>
        table === "jw_ws_schedule_table_datum_result_scheduleList"
          ? scheduleRows
          : [],
      queryGrouped: () => new Map(),
    } as unknown as Snapshot;

    expect(loadTeachers(snapshot).teachers).toEqual([
      { jwId: 10915, personId: 210065, nameCn: "黄大弘" },
    ]);
  });
});
