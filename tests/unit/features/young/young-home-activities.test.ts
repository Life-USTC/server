import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw, withAdapter, cache } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  withAdapter: vi.fn(),
  cache: vi.fn(),
}));
vi.mock("@/lib/db/prisma-adapter", () => ({
  withRuntimeDatabaseAdapter: withAdapter,
}));
vi.mock("@/features/catalog/server/catalog-runtime-cache", () => ({
  cachedCatalogRuntimeData: cache,
}));
vi.mock("@/lib/site-url", () => ({
  getCanonicalOrigin: () => "https://example.test",
}));

import {
  readYoungHomeActivities,
  readYoungHomeActivityFacts,
} from "@/features/young/server/young-home-activities";

const today = new Date("2035-09-15T00:00:00+08:00");
beforeEach(() => {
  vi.resetAllMocks();
  withAdapter.mockImplementation(async (_role, work) => work({ queryRaw }));
  queryRaw.mockResolvedValue({ rows: [] });
  cache.mockImplementation(async (_namespace, _key, _origin, load) => load());
});
describe("home activity projection boundaries", () => {
  it.each([0, -1, 1.5, 51, NaN])(
    "rejects invalid limit %s without a query",
    async (limit) => {
      await expect(readYoungHomeActivityFacts(today, limit)).rejects.toThrow(
        RangeError,
      );
      expect(withAdapter).not.toHaveBeenCalled();
    },
  );
  it("rejects invalid day and corrupt driver timestamps", async () => {
    await expect(readYoungHomeActivityFacts(new Date(NaN), 5)).rejects.toThrow(
      RangeError,
    );
    queryRaw.mockResolvedValueOnce({
      rows: [["42", "Event", "invalid", null, null, null]],
    });
    await expect(readYoungHomeActivityFacts(today, 5)).rejects.toThrow(
      "Invalid Young activity timestamp",
    );
  });
  it("uses day/limit/shape cache identity and the application database role", async () => {
    await readYoungHomeActivities(today, 5);
    expect(cache).toHaveBeenCalledWith(
      "catalog:young-events-list",
      JSON.stringify({
        shape: "home-date-groups-v1",
        today: today.toISOString(),
        limit: 5,
      }),
      "https://example.test",
      expect.any(Function),
    );
    expect(withAdapter).toHaveBeenCalledWith("app", expect.any(Function));
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});
