import { describe, expect, it } from "vitest";
import type { Snapshot } from "@/static-loader/snapshot";
import {
  isYoungEventsSnapshotComplete,
  loadYoungEvents,
  youngSnapshotSyncedAt,
} from "@/static-loader/young-plan";

const ACTIVE_TABLE = "young_mobile_item_enrolment_list_result_records";
const ENDED_TABLE = "young_mobile_item_end_list_result_records";

function fakeSnapshot({
  metadata = {
    young_events_mode: "full",
    young_events_synced_at: "2026-09-15T01:00:00+00:00",
  },
  tables = {},
}: {
  metadata?: Record<string, string>;
  tables?: Record<string, Record<string, unknown>[]>;
}): Snapshot {
  return {
    metadata: () => metadata,
    hasTable: (table: string) => table in tables,
    queryAll: (table: string) => tables[table] ?? [],
    queryGrouped: (table: string, parentColumn = "parent_store_id") => {
      const grouped = new Map<number, Record<string, unknown>[]>();
      for (const row of tables[table] ?? []) {
        const parent = row[parentColumn];
        if (typeof parent !== "number") continue;
        grouped.set(parent, [...(grouped.get(parent) ?? []), row]);
      }
      return grouped;
    },
  } as unknown as Snapshot;
}

describe("static young event plan", () => {
  it("only marks snapshots complete when both event tables are present", () => {
    expect(
      isYoungEventsSnapshotComplete(
        fakeSnapshot({
          tables: { [ACTIVE_TABLE]: [], [ENDED_TABLE]: [] },
        }),
      ),
    ).toBe(true);
    expect(
      isYoungEventsSnapshotComplete(
        fakeSnapshot({ tables: { [ACTIVE_TABLE]: [] } }),
      ),
    ).toBe(false);
    expect(
      isYoungEventsSnapshotComplete(
        fakeSnapshot({
          metadata: { young_events_mode: "partial" },
          tables: { [ACTIVE_TABLE]: [], [ENDED_TABLE]: [] },
        }),
      ),
    ).toBe(false);
  });

  it("uses the Young success timestamp even when another builder advances generated_at", () => {
    const snapshot = fakeSnapshot({
      metadata: {
        young_events_mode: "full",
        young_events_synced_at: "2026-09-10T01:00:00+00:00",
        generated_at: "2026-09-15T01:00:00Z",
      },
      tables: { [ACTIVE_TABLE]: [], [ENDED_TABLE]: [] },
    });
    expect(youngSnapshotSyncedAt(snapshot)?.toISOString()).toBe(
      "2026-09-10T01:00:00.000Z",
    );
    for (const value of [undefined, "invalid", "2026-09-15T01:00:00"]) {
      expect(
        youngSnapshotSyncedAt(
          fakeSnapshot({
            metadata: {
              young_events_mode: "full",
              ...(value ? { young_events_synced_at: value } : {}),
            },
            tables: { [ACTIVE_TABLE]: [], [ENDED_TABLE]: [] },
          }),
        ),
      ).toBeUndefined();
    }
  });

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
            itemStatus: "26",
            applyStatus: "26",
            needApply: "1",
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
      activityStatusCode: "26",
      signupStatusCode: "26",
      requiresSignup: true,
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

  it("maps the extended upstream columns and preserves raw data", () => {
    const snapshot = fakeSnapshot({
      tables: {
        [ENDED_TABLE]: [
          {
            store_id: 1,
            id: "ev1",
            itemName: "活动",
            baseContent: "<p>介绍</p>",
            conceive: "<p>须知</p>",
            activityLevel_dictText: "院级",
            module_dictText: "美",
            form_dictText: "提交作品",
            nj: "1,2",
            sponsor_dictText: "校团委",
            linkMan: "张三",
            tel: "13800000000",
            duration: 2.5,
            serviceHour: "2",
            sumHours: 76,
            sumPersons: 27,
            partakeNum: 30,
            favCount: 4,
            itemLimitNum: 50,
            createTime: "2026-08-08 23:53:40",
            auditTime: "2026-08-10 10:24:19",
            updateTime: "2026-08-11 08:00:00",
            itemStatus: "34",
            applyStatus: "28",
            needApply: "1",
          },
        ],
      },
    });

    const build = loadYoungEvents(snapshot)?.[0];
    expect(build).toMatchObject({
      description: "<p>介绍</p>",
      participationNotes: "<p>须知</p>",
      activityLevel: "院级",
      module: "美",
      form: "提交作品",
      grades: "1,2",
      sponsor: "校团委",
      contactName: "张三",
      contactTel: "13800000000",
      duration: 2.5,
      serviceHour: 2,
      sumHours: 76,
      sumPersons: 27,
      partakeNum: 30,
      favCount: 4,
      limitNum: 50,
      activityStatusCode: "34",
      signupStatusCode: "28",
      requiresSignup: true,
    });
    expect(build?.createdAtUpstream?.toISOString()).toBe(
      "2026-08-08T15:53:40.000Z",
    );
    expect(build?.auditedAt?.toISOString()).toBe("2026-08-10T02:24:19.000Z");
    expect(build?.updatedAtUpstream?.toISOString()).toBe(
      "2026-08-11T00:00:00.000Z",
    );
    // The raw upstream record remains available even after adding typed columns.
    expect(
      (JSON.parse(build?.rawJson ?? "{}") as Record<string, unknown>)
        .applyStatus,
    ).toBe("28");
  });

  it("joins the itemPlaceDTO places subtables onto each record", () => {
    const snapshot = fakeSnapshot({
      tables: {
        [ENDED_TABLE]: [
          { store_id: 1, id: "ev1", itemName: "有场地" },
          { store_id: 2, id: "ev2", itemName: "无场地" },
        ],
        [`${ENDED_TABLE}_itemPlaceDTO`]: [
          { store_id: 10, parent_store_id: 1, itemId: "ev1" },
        ],
        [`${ENDED_TABLE}_itemPlaceDTO_places`]: [
          {
            store_id: 101,
            parent_store_id: 10,
            position: 1,
            placeInfo: "西区活动中心",
            placeSt: "2026-08-21 09:00:00",
            placeEt: "2026-08-21 11:00:00",
          },
          {
            store_id: 100,
            parent_store_id: 10,
            position: 0,
            id: "slot-east",
            createTime: 1785139693000,
            placeInfo: "东区礼堂",
            placeSt: "2026-08-20 14:00:00",
            placeEt: "2026-08-20 16:00:00",
          },
        ],
      },
    });

    const builds = loadYoungEvents(snapshot);
    expect(builds?.find((build) => build.youngId === "ev1")?.places).toEqual([
      {
        placeInfo: "东区礼堂",
        placeSt: "2026-08-20 14:00:00",
        placeEt: "2026-08-20 16:00:00",
      },
      {
        placeInfo: "西区活动中心",
        placeSt: "2026-08-21 09:00:00",
        placeEt: "2026-08-21 11:00:00",
      },
    ]);
    expect(
      builds?.find((build) => build.youngId === "ev2")?.places,
    ).toBeUndefined();
    const raw = JSON.parse(
      builds?.find((build) => build.youngId === "ev1")?.rawJson ?? "{}",
    ) as Record<string, unknown>;
    expect(raw.itemPlaceDTO).toMatchObject({
      itemId: "ev1",
      places: [
        { id: "slot-east", createTime: 1785139693000 },
        { placeInfo: "西区活动中心" },
      ],
    });
    expect(raw.itemPlaceDTO).not.toHaveProperty("store_id");
  });

  it("leaves places undefined when the subtables are absent", () => {
    const snapshot = fakeSnapshot({
      tables: { [ENDED_TABLE]: [{ store_id: 1, id: "ev1", itemName: "活动" }] },
    });
    expect(loadYoungEvents(snapshot)?.[0]?.places).toBeUndefined();
  });

  it("returns an empty list when the young tables exist but hold no rows", () => {
    const snapshot = fakeSnapshot({
      tables: { [ACTIVE_TABLE]: [], [ENDED_TABLE]: [] },
    });
    expect(loadYoungEvents(snapshot)).toEqual([]);
  });
});
