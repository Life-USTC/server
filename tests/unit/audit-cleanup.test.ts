import {
  buildAuditLogCleanupWhere,
  cleanupAuditLogsUntilStable,
  deleteAuditLogsForUsersAndTargets,
} from "@tools/shared/audit-cleanup";
import { describe, expect, it, vi } from "vitest";

describe("audit cleanup helpers", () => {
  it("builds deduplicated user and target predicates", () => {
    expect(
      buildAuditLogCleanupWhere({
        targets: [
          { targetType: "comment", targetId: "comment-1" },
          { targetType: "comment", targetId: "comment-1" },
          { targetType: "upload", targetId: 42 },
          { targetType: " ", targetId: "ignored" },
        ],
        userIds: ["user-1", "user-1", ""],
      }),
    ).toEqual({
      OR: [
        { userId: { in: ["user-1"] } },
        { targetId: { in: ["comment-1"] }, targetType: "comment" },
        { targetId: { in: ["42"] }, targetType: "upload" },
      ],
    });
  });

  it("supports grouped target cleanup", async () => {
    const prisma = {
      auditLog: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        count: vi.fn(async () => 0),
      },
    };

    await deleteAuditLogsForUsersAndTargets(prisma, {
      targets: [
        { targetType: "user", targetIds: ["user-1"] },
        { targetType: "comment", targetIds: ["comment-1", "comment-1"] },
      ],
      userIds: ["actor-1"],
    });

    expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: { in: ["actor-1"] } },
          { targetId: { in: ["user-1"] }, targetType: "user" },
          { targetId: { in: ["comment-1"] }, targetType: "comment" },
        ],
      },
    });
  });

  it("retries cleanup until matching audit rows stay absent", async () => {
    const remainingCounts = [1, 0, 0];
    const prisma = {
      auditLog: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        count: vi.fn(async () => remainingCounts.shift() ?? 0),
      },
    };

    await cleanupAuditLogsUntilStable(
      prisma,
      { targets: [{ targetType: "comment", targetId: "comment-1" }] },
      { attempts: 3, retryDelayMs: 0, stablePasses: 2 },
    );

    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(3);
    expect(prisma.auditLog.count).toHaveBeenCalledTimes(3);
  });
});
