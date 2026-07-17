import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertSectionSnapshotNotOlderThanSource,
  reconcileSectionSourceLifecycle,
} from "@/static-loader/section-lifecycle";

const OBSERVED_AT = new Date("2026-07-18T03:00:00.000Z");
const PREVIOUSLY_RETIRED_AT = new Date("2026-07-17T03:00:00.000Z");
const PREVIOUSLY_SEEN_AT = new Date("2026-07-16T03:00:00.000Z");

function lifecycleClient() {
  return {
    auditLog: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    section: {
      count: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe("static Section source lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reactivates seen rows, retires only missing in-scope rows, and audits both", async () => {
    const tx = lifecycleClient();
    tx.section.count.mockResolvedValueOnce(8).mockResolvedValueOnce(2);
    tx.section.findMany
      .mockResolvedValueOnce([
        {
          id: 11,
          jwId: 101,
          retiredAt: PREVIOUSLY_RETIRED_AT,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 12,
          jwId: 102,
          sourceLastSeenAt: PREVIOUSLY_SEEN_AT,
        },
      ]);

    const result = await reconcileSectionSourceLifecycle(tx, {
      observedAt: OBSERVED_AT,
      retirementEnabled: true,
      expectedRetirementCandidateCount: 1,
      scopedSemesterIds: [41, 42],
      seenSectionJwIds: [101, 103],
      snapshotSha256: "snapshot-sha",
    });

    expect(tx.section.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        semesterId: { in: [41, 42] },
        jwId: { in: [101, 103] },
        retiredAt: null,
        OR: [
          { sourceLastSeenAt: null },
          { sourceLastSeenAt: { lt: OBSERVED_AT } },
        ],
      },
      data: {
        sourceLastSeenAt: OBSERVED_AT,
      },
    });
    expect(tx.section.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: { in: [11] },
        retiredAt: { lt: OBSERVED_AT },
      },
      data: {
        sourceLastSeenAt: OBSERVED_AT,
        retiredAt: null,
      },
    });
    expect(tx.section.updateMany).toHaveBeenNthCalledWith(3, {
      where: { id: { in: [12] }, retiredAt: null },
      data: { retiredAt: OBSERVED_AT },
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          action: "section_reactivate",
          targetId: "11",
          targetType: "section",
          metadata: expect.objectContaining({
            jwId: 101,
            observedAt: OBSERVED_AT.toISOString(),
            previousRetiredAt: PREVIOUSLY_RETIRED_AT.toISOString(),
            snapshotSha256: "snapshot-sha",
            source: "static-loader",
          }),
        }),
        expect.objectContaining({
          action: "section_retire",
          targetId: "12",
          targetType: "section",
          metadata: expect.objectContaining({
            jwId: 102,
            observedAt: OBSERVED_AT.toISOString(),
            previousSourceLastSeenAt: PREVIOUSLY_SEEN_AT.toISOString(),
            snapshotSha256: "snapshot-sha",
            source: "static-loader",
          }),
        }),
      ],
    });
    expect(result).toEqual({
      enabled: true,
      scopeSemesterCount: 2,
      seenSectionCount: 2,
      retirementCandidateCount: 1,
      retiredCount: 1,
      reactivatedCount: 1,
      before: { active: 8, retired: 2, total: 10 },
      after: { active: 8, retired: 2, total: 10 },
    });
  });

  it("reports candidates but cannot retire them without the explicit opt-in", async () => {
    const tx = lifecycleClient();
    tx.section.count.mockResolvedValueOnce(8).mockResolvedValueOnce(0);
    tx.section.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 12,
        jwId: 102,
        sourceLastSeenAt: PREVIOUSLY_SEEN_AT,
      },
    ]);

    const result = await reconcileSectionSourceLifecycle(tx, {
      observedAt: OBSERVED_AT,
      retirementEnabled: false,
      expectedRetirementCandidateCount: null,
      scopedSemesterIds: [41],
      seenSectionJwIds: [101],
      snapshotSha256: "snapshot-sha",
    });

    expect(tx.section.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      enabled: false,
      retirementCandidateCount: 1,
      retiredCount: 0,
      reactivatedCount: 0,
      before: { active: 8, retired: 0, total: 8 },
      after: { active: 8, retired: 0, total: 8 },
    });
  });

  it("does nothing when the completeness gate yields no semester scope", async () => {
    const tx = lifecycleClient();

    await expect(
      reconcileSectionSourceLifecycle(tx, {
        observedAt: OBSERVED_AT,
        retirementEnabled: true,
        expectedRetirementCandidateCount: null,
        scopedSemesterIds: [],
        seenSectionJwIds: [],
        snapshotSha256: "snapshot-sha",
      }),
    ).resolves.toEqual({
      enabled: true,
      scopeSemesterCount: 0,
      seenSectionCount: 0,
      retirementCandidateCount: 0,
      retiredCount: 0,
      reactivatedCount: 0,
      before: { active: 0, retired: 0, total: 0 },
      after: { active: 0, retired: 0, total: 0 },
    });
    expect(tx.section.findMany).not.toHaveBeenCalled();
    expect(tx.section.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("rejects an older snapshot before writes regardless of retirement opt-in", async () => {
    const tx = lifecycleClient();
    const newerObservedAt = new Date("2026-07-19T03:00:00.000Z");
    tx.section.findFirst.mockResolvedValueOnce({
      jwId: 102,
      sourceLastSeenAt: newerObservedAt,
    });

    await expect(
      assertSectionSnapshotNotOlderThanSource(tx, {
        observedAt: OBSERVED_AT,
        scopedSemesterIds: [42, 41, 42],
      }),
    ).rejects.toThrow(
      `Section 102 was observed in a newer snapshot at ${newerObservedAt.toISOString()}`,
    );
    expect(tx.section.findFirst).toHaveBeenCalledWith({
      where: {
        semesterId: { in: [41, 42] },
        sourceLastSeenAt: { gt: OBSERVED_AT },
      },
      orderBy: { sourceLastSeenAt: "desc" },
      select: { jwId: true, sourceLastSeenAt: true },
    });
    expect(tx.section.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("does not reactivate or regress a row from an older snapshot", async () => {
    const tx = lifecycleClient();
    tx.section.count.mockResolvedValueOnce(7).mockResolvedValueOnce(1);
    tx.section.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await reconcileSectionSourceLifecycle(tx, {
      observedAt: OBSERVED_AT,
      retirementEnabled: false,
      expectedRetirementCandidateCount: null,
      scopedSemesterIds: [41],
      seenSectionJwIds: [101],
      snapshotSha256: "older-snapshot",
    });

    expect(tx.section.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        semesterId: { in: [41] },
        jwId: { in: [101] },
        retiredAt: { lt: OBSERVED_AT },
      },
      select: { id: true, jwId: true, retiredAt: true },
    });
    expect(tx.section.updateMany).toHaveBeenCalledOnce();
    expect(result.reactivatedCount).toBe(0);
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("fails closed when a destructive scope has no seen Sections", async () => {
    const tx = lifecycleClient();

    await expect(
      reconcileSectionSourceLifecycle(tx, {
        observedAt: OBSERVED_AT,
        retirementEnabled: true,
        expectedRetirementCandidateCount: 0,
        scopedSemesterIds: [41],
        seenSectionJwIds: [],
        snapshotSha256: "snapshot-sha",
      }),
    ).rejects.toThrow("validated source set is empty");
    expect(tx.section.count).not.toHaveBeenCalled();
    expect(tx.section.updateMany).not.toHaveBeenCalled();
  });

  it("aborts before writes when the approved candidate count changed", async () => {
    const tx = lifecycleClient();
    tx.section.count.mockResolvedValueOnce(8).mockResolvedValueOnce(0);
    tx.section.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 12, jwId: 102, sourceLastSeenAt: PREVIOUSLY_SEEN_AT },
      ]);

    await expect(
      reconcileSectionSourceLifecycle(tx, {
        observedAt: OBSERVED_AT,
        retirementEnabled: true,
        expectedRetirementCandidateCount: 2,
        scopedSemesterIds: [41],
        seenSectionJwIds: [101],
        snapshotSha256: "snapshot-sha",
      }),
    ).rejects.toThrow(
      "Approved Section retirement candidate count 2 does not match actual count 1",
    );
    expect(tx.section.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("refuses to retire a row last seen by a newer snapshot", async () => {
    const tx = lifecycleClient();
    tx.section.count.mockResolvedValueOnce(8).mockResolvedValueOnce(0);
    tx.section.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 12,
        jwId: 102,
        sourceLastSeenAt: new Date("2026-07-19T03:00:00.000Z"),
      },
    ]);

    await expect(
      reconcileSectionSourceLifecycle(tx, {
        observedAt: OBSERVED_AT,
        retirementEnabled: true,
        expectedRetirementCandidateCount: 1,
        scopedSemesterIds: [41],
        seenSectionJwIds: [101],
        snapshotSha256: "older-snapshot",
      }),
    ).rejects.toThrow("snapshot older than their latest source observation");
    expect(tx.section.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  });
});
