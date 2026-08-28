import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileSectionPresence } from "@/static-loader/section-lifecycle";

const OBSERVED_AT = new Date("2026-07-18T03:00:00.000Z");
const PREVIOUSLY_RETIRED_AT = new Date("2026-07-17T03:00:00.000Z");

function lifecycleClient() {
  return {
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    auditLog: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    section: {
      count: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe("static Section presence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reactivates present rows and deactivates missing rows in one pass", async () => {
    const tx = lifecycleClient();
    tx.section.count.mockResolvedValueOnce(8).mockResolvedValueOnce(2);
    tx.section.findMany
      .mockResolvedValueOnce([
        { id: 11, jwId: 101, retiredAt: PREVIOUSLY_RETIRED_AT },
      ])
      .mockResolvedValueOnce([{ id: 12, jwId: 102 }])
      .mockResolvedValueOnce([
        { id: 11, jwId: 101, retiredAt: PREVIOUSLY_RETIRED_AT },
        { id: 12, jwId: 102, retiredAt: null },
      ]);

    const result = await reconcileSectionPresence(tx, {
      observedAt: OBSERVED_AT,
      scopedSemesterIds: [41, 42],
      seenSectionJwIds: [101, 103],
      snapshotSha256: "snapshot-sha",
    });

    expect(tx.section.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: [11] } },
      data: { retiredAt: null },
    });
    expect(tx.section.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: [12] }, retiredAt: null },
      data: { retiredAt: OBSERVED_AT },
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          action: "section_reactivate",
          targetId: "11",
          metadata: expect.objectContaining({ jwId: 101 }),
        }),
        expect.objectContaining({
          action: "section_retire",
          targetId: "12",
          metadata: expect.objectContaining({ jwId: 102 }),
        }),
      ],
    });
    expect(result).toEqual({
      status: "applied",
      scopeSemesterCount: 2,
      seenSectionCount: 2,
      missingSectionCount: 1,
      deactivatedCount: 1,
      reactivatedCount: 1,
      before: { active: 8, retired: 2, total: 10 },
      after: { active: 8, retired: 2, total: 10 },
    });
  });

  it("returns an explicit applied result for an empty scope", async () => {
    const tx = lifecycleClient();

    await expect(
      reconcileSectionPresence(tx, {
        observedAt: OBSERVED_AT,
        scopedSemesterIds: [],
        seenSectionJwIds: [],
        snapshotSha256: "snapshot-sha",
      }),
    ).resolves.toEqual({
      status: "applied",
      scopeSemesterCount: 0,
      seenSectionCount: 0,
      missingSectionCount: 0,
      deactivatedCount: 0,
      reactivatedCount: 0,
      before: { active: 0, retired: 0, total: 0 },
      after: { active: 0, retired: 0, total: 0 },
    });
    expect(tx.section.findMany).not.toHaveBeenCalled();
  });

  it("fails closed when a non-empty scope has no source Sections", async () => {
    const tx = lifecycleClient();

    await expect(
      reconcileSectionPresence(tx, {
        observedAt: OBSERVED_AT,
        scopedSemesterIds: [41],
        seenSectionJwIds: [],
        snapshotSha256: "snapshot-sha",
      }),
    ).rejects.toThrow("validated source set is empty");
    expect(tx.section.updateMany).not.toHaveBeenCalled();
  });

  it("rechecks locked rows before changing their state", async () => {
    const tx = lifecycleClient();
    tx.section.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    tx.section.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 12, jwId: 102 }])
      .mockResolvedValueOnce([{ id: 12, jwId: 102, retiredAt: OBSERVED_AT }]);

    const result = await reconcileSectionPresence(tx, {
      observedAt: OBSERVED_AT,
      scopedSemesterIds: [41],
      seenSectionJwIds: [101],
      snapshotSha256: "snapshot-sha",
    });

    expect(tx.section.updateMany).not.toHaveBeenCalled();
    expect(result.deactivatedCount).toBe(0);
  });
});
