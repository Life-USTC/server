/// <reference path="../../../src/static-loader/bun-sqlite.d.ts" />

import { afterEach, describe, expect, it, vi } from "vitest";

const { allMock, closeMock, queryMock } = vi.hoisted(() => {
  const allMock = vi.fn().mockReturnValue([
    { id: 1, parent_store_id: 10 },
    { id: 2, parent_store_id: 10 },
  ]);
  return {
    allMock,
    closeMock: vi.fn(),
    queryMock: vi.fn().mockReturnValue({ all: allMock }),
  };
});

vi.mock("bun:sqlite", () => ({
  Database: class {
    close = closeMock;
    query = queryMock;
  },
}));

afterEach(() => vi.clearAllMocks());

describe("static snapshot table cache", () => {
  it("reads and groups each table only once", async () => {
    const { Snapshot } = await import("@/static-loader/snapshot");
    const snapshot = new Snapshot("snapshot.sqlite");
    const rows = snapshot.queryAll("items");
    const grouped = snapshot.queryGrouped("items");

    expect(snapshot.queryAll("items")).toBe(rows);
    expect(snapshot.queryGrouped("items")).toBe(grouped);
    expect(grouped.get(10)).toEqual(rows);
    expect(queryMock).toHaveBeenCalledOnce();
    expect(allMock).toHaveBeenCalledOnce();
    snapshot.close();
    expect(closeMock).toHaveBeenCalledOnce();
  });

  it("releases selected tables and all their groupings while retaining other tables", async () => {
    const { Snapshot } = await import("@/static-loader/snapshot");
    const snapshot = new Snapshot("snapshot.sqlite");
    const roomRows = snapshot.queryAll("room");
    const roomGroups = snapshot.queryGrouped("room");
    const buildingRows = snapshot.queryAll("room_building");
    const buildingGroups = snapshot.queryGrouped("room_building");
    const buildingIds = snapshot.queryGrouped("room_building", "id");
    const campusGroups = snapshot.queryGrouped("room_building_campus");
    const originalReadCount = allMock.mock.calls.length;

    snapshot.clearCachedRows(["room_building"]);

    expect(snapshot.queryAll("room")).toBe(roomRows);
    expect(snapshot.queryGrouped("room")).toBe(roomGroups);
    expect(snapshot.queryGrouped("room_building_campus")).toBe(campusGroups);
    expect(allMock).toHaveBeenCalledTimes(originalReadCount);
    allMock.mockReturnValueOnce(buildingRows.map((row) => ({ ...row })));
    expect(snapshot.queryAll("room_building")).not.toBe(buildingRows);
    const rebuilt = snapshot.queryGrouped("room_building");
    const rebuiltIds = snapshot.queryGrouped("room_building", "id");
    expect(rebuilt).not.toBe(buildingGroups);
    expect(rebuilt).toEqual(buildingGroups);
    expect(rebuiltIds).not.toBe(buildingIds);
    expect(rebuiltIds).toEqual(buildingIds);
    expect(allMock).toHaveBeenCalledTimes(originalReadCount + 1);
    snapshot.close();
  });

  it("keeps all caches for an empty selection and clears all when omitted", async () => {
    const { Snapshot } = await import("@/static-loader/snapshot");
    const snapshot = new Snapshot("snapshot.sqlite");
    const groups = snapshot.queryGrouped("items");
    snapshot.clearCachedRows([]);
    expect(snapshot.queryGrouped("items")).toBe(groups);
    expect(allMock).toHaveBeenCalledOnce();

    snapshot.clearCachedRows();
    expect(snapshot.queryGrouped("items")).not.toBe(groups);
    expect(allMock).toHaveBeenCalledTimes(2);
    snapshot.close();
  });

  it("rejects unsafe table names", async () => {
    const { Snapshot } = await import("@/static-loader/snapshot");
    const snapshot = new Snapshot("snapshot.sqlite");
    expect(() => snapshot.queryAll('items"')).toThrow("Invalid snapshot table");
    expect(queryMock).not.toHaveBeenCalled();
  });
});
