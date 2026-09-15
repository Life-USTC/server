import { describe, expect, it } from "vitest";
import type { Snapshot } from "@/static-loader/snapshot";
import { loadYoungEvents } from "@/static-loader/young-plan";

const ACTIVE_TABLE = "young_mobile_item_enrolment_list_result_records";
const ENDED_TABLE = "young_mobile_item_end_list_result_records";

function fakeSnapshot({
  metadata = { young_events_mode: "full" },
  tables = {},
}: {
  metadata?: Record<string, string>;
  tables?: Record<string, Record<string, unknown>[]>;
}): Snapshot {
  return {
    metadata: () => metadata,
    hasTable: (table: string) => table in tables,
    queryAll: (table: string) => tables[table] ?? [],
    queryGrouped: () => new Map(),
  } as unknown as Snapshot;
}

describe("static young event plan", () => {
  it("returns null when the snapshot predates the young builder", () => {
    const snapshot = fakeSnapshot({ metadata: {} });
    expect(loadYoungEvents(snapshot)).toBeNull();
  });

  it("maps upstream columns and strips internal store columns from rawJson", () => {
    const snapshot = fakeSnapshot({
      tables: {
        [ACTIVE_TABLE]: [
          {
            id: 123,
            itemName: "秋日读书会",
            itemCategory_dictText: "单次项目",
            businessDeptName: "校团委",
            organizer_dictText: "学生会",
            itemStatus_dictText: "进行中",
            registrationStatus: "报名中",
            placeInfo: "东区图书馆",
            pic: "https://example.com/pic.jpg",
            validHour: "2.5",
            peopleNum: "30",
            applyNum: 12,
            st: "2026-09-10 14:00:00",
            et: "2026-09-10 16:00:00",
            applySt: "2026-09-01 00:00:00",
            applyEt: "2026-09-09 23:59:59",
            store_id: 5,
            fetch_id: 7,
            position: 0,
          },
        ],
      },
    });

    const builds = loadYoungEvents(snapshot);
    expect(builds).toHaveLength(1);
    const build = builds?.[0];
    expect(build).toMatchObject({
      youngId: "123",
      name: "秋日读书会",
      category: "单次项目",
      department: "校团委",
      organizer: "学生会",
      status: "进行中",
      registrationStatus: "报名中",
      location: "东区图书馆",
      imageUrl: "https://example.com/pic.jpg",
      hours: 2.5,
      capacity: 30,
      appliedCount: 12,
      isActive: true,
    });
    expect(build?.startAt?.toISOString()).toBe("2026-09-10T06:00:00.000Z");
    expect(build?.applyEndAt?.toISOString()).toBe("2026-09-09T15:59:59.000Z");

    const raw = JSON.parse(build?.rawJson ?? "{}") as Record<string, unknown>;
    expect(raw.itemName).toBe("秋日读书会");
    expect(raw).not.toHaveProperty("store_id");
    expect(raw).not.toHaveProperty("fetch_id");
    expect(raw).not.toHaveProperty("position");
  });

  it("merges ended and active rows with active winning on youngId conflict", () => {
    const snapshot = fakeSnapshot({
      tables: {
        [ENDED_TABLE]: [{ id: 1, itemName: "旧活动" }],
        [ACTIVE_TABLE]: [
          { id: 1, itemName: "同名进行中活动" },
          { id: 2, itemName: "另一个活动" },
        ],
      },
    });

    const builds = loadYoungEvents(snapshot);
    expect(builds).toHaveLength(2);
    const conflicted = builds?.find((build) => build.youngId === "1");
    expect(conflicted).toMatchObject({
      name: "同名进行中活动",
      isActive: true,
    });
    expect(builds?.find((build) => build.youngId === "2")?.isActive).toBe(true);
  });

  it("skips rows without a usable id and tolerates missing columns", () => {
    const snapshot = fakeSnapshot({
      tables: {
        [ACTIVE_TABLE]: [{ itemName: "没有 id" }, { id: 9 }],
      },
    });

    const builds = loadYoungEvents(snapshot);
    expect(builds).toHaveLength(1);
    expect(builds?.[0]).toMatchObject({
      youngId: "9",
      name: "9",
      isActive: true,
    });
    expect(builds?.[0]?.startAt).toBeUndefined();
  });

  it("returns an empty list when the young tables exist but hold no rows", () => {
    const snapshot = fakeSnapshot({
      tables: { [ACTIVE_TABLE]: [], [ENDED_TABLE]: [] },
    });
    expect(loadYoungEvents(snapshot)).toEqual([]);
  });
});
