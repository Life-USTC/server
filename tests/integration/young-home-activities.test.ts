import { describe, expect } from "vitest";
import {
  readYoungHomeActivities,
  readYoungHomeActivityFacts,
} from "@/features/young/server/young-home-activities";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import {
  recordStaticImportState,
  STATIC_IMPORT_TRANSFORM_REVISION,
} from "@/static-loader/import-state";
import { syncYoungSnapshot } from "@/static-loader/import-young";
import { isolatedNodeTest as it } from "../shared/isolated-node-fixture";

const today = new Date("2035-09-15T00:00:00+08:00");
const date = (value: string) => new Date(value);
const rows = [
  {
    youngId: "ongoing",
    startAt: date("2035-08-24T14:25:00+08:00"),
    endAt: date("2036-01-15T14:25:00+08:00"),
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    youngId: `future-range-${i}`,
    startAt: date("2035-09-15T00:30:00+08:00"),
    endAt: date("2036-01-15T14:25:00+08:00"),
  })),
  {
    youngId: "today-early",
    startAt: date("2035-09-15T01:00:00+08:00"),
    endAt: date("2035-09-15T02:00:00+08:00"),
  },
  {
    youngId: "lecture",
    startAt: date("2035-09-15T10:00:00+08:00"),
    endAt: date("2035-09-15T12:00:00+08:00"),
  },
  // Same UTC date, different Shanghai dates: must be a range.
  {
    youngId: "cross-shanghai-midnight",
    startAt: date("2035-09-15T15:30:00Z"),
    endAt: date("2035-09-15T16:30:00Z"),
  },
  // Different UTC dates, same Shanghai date: must remain a concrete session.
  {
    youngId: "same-shanghai-day",
    startAt: date("2035-09-15T16:30:00Z"),
    endAt: date("2035-09-16T01:00:00Z"),
  },
  {
    youngId: "start-only",
    startAt: date("2035-09-16T10:00:00+08:00"),
    endAt: null,
  },
  {
    youngId: "zero-length",
    startAt: date("2035-09-17T10:00:00+08:00"),
    endAt: date("2035-09-17T10:00:00+08:00"),
  },
  {
    youngId: "past",
    startAt: date("2035-09-14T10:00:00+08:00"),
    endAt: date("2035-09-14T12:00:00+08:00"),
  },
  {
    youngId: "ends-at-boundary",
    startAt: date("2035-09-14T23:00:00+08:00"),
    endAt: today,
  },
  {
    youngId: "reversed",
    startAt: date("2035-09-15T10:00:00+08:00"),
    endAt: date("2035-09-15T09:00:00+08:00"),
  },
  { youngId: "unknown", startAt: null, endAt: null },
  {
    youngId: "end-only",
    startAt: null,
    endAt: date("2035-09-16T12:00:00+08:00"),
  },
  {
    youngId: "inactive",
    startAt: date("2035-09-15T10:00:00+08:00"),
    endAt: null,
    isActive: false,
  },
];

describe("homepage activity date groups with real PostgreSQL timestamps", () => {
  it("classifies Shanghai dates before each bounded group and preserves facts", {
    tags: ["@Overview/Service"],
  }, async ({ isolatedDatabase, nodeRuntime }) => {
    await isolatedDatabase.owner.youngEvent.createMany({
      data: rows.map((row) => ({
        name: row.youngId,
        location: "Library",
        organizer: "Campus club",
        rawJson: {},
        isActive: true,
        ...row,
      })),
    });
    const before = await isolatedDatabase.owner.youngEvent.findMany({
      orderBy: { youngId: "asc" },
    });
    const data = await nodeRuntime.run(() =>
      readYoungHomeActivityFacts(today, 50),
    );
    expect(
      data.filter((row) => !row.crossDay).map((row) => row.youngId),
    ).toEqual([
      "today-early",
      "lecture",
      "same-shanghai-day",
      "start-only",
      "zero-length",
    ]);
    expect(
      data.filter((row) => row.crossDay).map((row) => row.youngId),
    ).toEqual([
      "ongoing",
      ...Array.from({ length: 6 }, (_, i) => `future-range-${i}`),
      "cross-shanghai-midnight",
    ]);
    expect(
      data.find((row) => row.youngId === "same-shanghai-day"),
    ).toMatchObject({
      startAt: "2035-09-16T00:30:00+08:00",
      endAt: "2035-09-16T09:00:00+08:00",
      location: "Library",
      organizer: "Campus club",
    });
    expect(
      data.find((row) => row.youngId === "cross-shanghai-midnight"),
    ).toMatchObject({
      startAt: "2035-09-15T23:30:00+08:00",
      endAt: "2035-09-16T00:30:00+08:00",
    });
    expect(data.find((row) => row.youngId === "start-only")?.endAt).toBeNull();
    const bounded = await nodeRuntime.run(() =>
      readYoungHomeActivityFacts(today, 2),
    );
    expect(bounded.map((row) => row.youngId)).toEqual([
      "today-early",
      "lecture",
      "ongoing",
      "future-range-0",
    ]);
    expect(
      await isolatedDatabase.owner.youngEvent.findMany({
        orderBy: { youngId: "asc" },
      }),
    ).toEqual(before);
  });
});

it("refreshes cached home groups after committed Young import changes", {
  tags: ["@Overview/Service"],
}, async ({ isolatedDatabase, nodeRuntime }) => {
  const db = isolatedDatabase.owner;
  const builds = [
    {
      youngId: "lecture",
      name: "Lecture",
      startAt: date("2035-09-15T10:00:00+08:00"),
      endAt: date("2035-09-15T12:00:00+08:00"),
      isActive: true,
      rawJson: "{}",
    },
    {
      youngId: "withdrawn",
      name: "Withdrawn",
      startAt: date("2035-09-15T11:00:00+08:00"),
      endAt: date("2035-09-15T13:00:00+08:00"),
      isActive: true,
      rawJson: "{}",
    },
  ];
  resetPublicRuntimeCacheForTest();
  try {
    await db.$transaction(async (tx) => {
      const syncedAt = await syncYoungSnapshot(
        tx,
        builds,
        date("2035-09-01T00:00:00Z"),
      );
      await recordStaticImportState(tx, {
        observedAt: date("2035-09-01T00:00:00Z"),
        snapshotSha256: "a".repeat(64),
        transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
        youngSyncedAt: syncedAt,
      });
    });
    const first = await nodeRuntime.run(() =>
      readYoungHomeActivities(today, 5),
    );
    expect(first.map((row) => [row.youngId, row.crossDay])).toEqual([
      ["lecture", false],
      ["withdrawn", false],
    ]);
    await db.$transaction(async (tx) => {
      const syncedAt = await syncYoungSnapshot(
        tx,
        [
          { ...builds[0], endAt: date("2035-09-16T12:00:00+08:00") },
          { ...builds[1], isActive: false },
        ],
        date("2035-09-02T00:00:00Z"),
      );
      await recordStaticImportState(tx, {
        observedAt: date("2035-09-02T00:00:00Z"),
        snapshotSha256: "b".repeat(64),
        transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
        youngSyncedAt: syncedAt,
      });
    });
    const next = await nodeRuntime.run(() => readYoungHomeActivities(today, 5));
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      youngId: "lecture",
      crossDay: true,
      endAt: "2035-09-16T12:00:00+08:00",
    });
  } finally {
    resetPublicRuntimeCacheForTest();
  }
});
