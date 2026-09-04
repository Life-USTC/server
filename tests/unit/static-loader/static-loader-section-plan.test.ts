import { describe, expect, it } from "vitest";
import { loadScheduleData } from "@/static-loader/section-plan";
import type { Snapshot } from "@/static-loader/snapshot";

describe("static schedule plan", () => {
  it("keeps a schedule-only teacher on both the schedule and Section", () => {
    const rowsByTable: Record<string, Record<string, unknown>[]> = {
      jw_ws_schedule_table_datum_result_scheduleGroupList: [
        { id: 2, lessonId: 1 },
      ],
      jw_ws_schedule_table_datum_result_scheduleList: [
        {
          lessonId: 1,
          scheduleGroupId: 2,
          teacherId: 10915,
          personId: 210065,
          date: "2026-01-01",
        },
      ],
    };
    const snapshot = {
      queryAll: (table: string) => rowsByTable[table] ?? [],
      queryGrouped: () => new Map(),
    } as unknown as Snapshot;

    const plan = loadScheduleData(snapshot, new Set([1]), [], []);

    expect(plan.schedules).toHaveLength(1);
    expect(plan.schedules[0].teacherJwIds).toEqual([10915]);
    expect(plan.scheduleInfrastructureTeacherPairs).toEqual([
      { sectionJwId: 1, teacherJwId: 10915 },
    ]);
  });

  it("rejects a ScheduleGroup without its upstream jwId", () => {
    const snapshot = {
      queryAll: (table: string) =>
        table === "jw_ws_schedule_table_datum_result_scheduleGroupList"
          ? [{ lessonId: 1 }]
          : [],
      queryGrouped: () => new Map(),
    } as unknown as Snapshot;

    expect(() => loadScheduleData(snapshot, new Set([1]), [], [])).toThrow(
      "ScheduleGroup for Section jwId 1 has no valid upstream jwId",
    );
  });

  it("rejects a Schedule without its upstream ScheduleGroup ID", () => {
    const snapshot = {
      queryAll: (table: string) =>
        table === "jw_ws_schedule_table_datum_result_scheduleList"
          ? [{ lessonId: 1 }]
          : [],
      queryGrouped: () => new Map(),
    } as unknown as Snapshot;

    expect(() => loadScheduleData(snapshot, new Set([1]), [], [])).toThrow(
      "Schedule for Section jwId 1 is missing scheduleGroupId",
    );
  });
});
