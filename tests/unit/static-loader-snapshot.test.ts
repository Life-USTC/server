/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />

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

  it("rejects unsafe table names", async () => {
    const { Snapshot } = await import("@/static-loader/snapshot");
    const snapshot = new Snapshot("snapshot.sqlite");
    expect(() => snapshot.queryAll('items"')).toThrow("Invalid snapshot table");
    expect(queryMock).not.toHaveBeenCalled();
  });
});
