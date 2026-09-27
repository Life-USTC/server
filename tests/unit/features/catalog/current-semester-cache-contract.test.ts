import { afterEach, expect, it, vi } from "vitest";
import { getCachedCurrentSemester } from "@/features/catalog/server/academic-metadata-read-model";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

const { findFirst, findRevision } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findRevision: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    semester: { findFirst },
    staticImportState: { findUnique: findRevision },
  },
}));
afterEach(() => {
  resetPublicRuntimeCacheForTest();
  vi.clearAllMocks();
});
it("semester.current-semester-cache-invalidation", async () => {
  resetPublicRuntimeCacheForTest();
  const firstDay = new Date("2049-08-31T15:59:59.999Z");
  const nextDay = new Date("2049-08-31T16:00:00Z");
  const first = { id: 1, jwId: 100, nameCn: "Old semester" };
  const second = { id: 2, jwId: 200, nameCn: "New semester" };
  findRevision.mockResolvedValue({
    snapshotSha256: "a".repeat(64),
    updatedAt: new Date("2049-08-01"),
  });
  findFirst.mockResolvedValue(first);
  expect(await getCachedCurrentSemester(firstDay)).toEqual(first);
  findFirst.mockResolvedValue(second);
  expect(await getCachedCurrentSemester(firstDay)).toEqual(first);
  expect(findFirst).toHaveBeenCalledTimes(1);
  expect(await getCachedCurrentSemester(nextDay)).toEqual(second);
  expect(findFirst).toHaveBeenCalledTimes(2);
  findFirst.mockResolvedValue(null);
  // Same day, new committed import: an old non-null cache cannot shadow removal of the current term.
  findRevision.mockResolvedValue({
    snapshotSha256: "b".repeat(64),
    updatedAt: new Date("2049-08-02"),
  });
  expect(await getCachedCurrentSemester(nextDay)).toBeNull();
  expect(findFirst).toHaveBeenCalledTimes(3);
  findFirst.mockResolvedValue(first);
  expect(await getCachedCurrentSemester(nextDay)).toBeNull();
  expect(findFirst).toHaveBeenCalledTimes(3);
  // Reimporting an identical snapshot still advances updatedAt and invalidates a cached absence.
  findRevision.mockResolvedValue({
    snapshotSha256: "b".repeat(64),
    updatedAt: new Date("2049-08-03"),
  });
  expect(await getCachedCurrentSemester(nextDay)).toEqual(first);
  expect(findFirst).toHaveBeenCalledTimes(4);
});
