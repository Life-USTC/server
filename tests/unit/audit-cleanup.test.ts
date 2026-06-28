import { describe, expect, it, vi } from "vitest";
import {
  buildAuditLogCleanupWhere,
  cleanupAuditLogsUntilStable,
  deleteAuditLogsForUsersAndTargets,
} from "../shared/audit-cleanup";

describe("审计清理辅助函数", () => {
  it("构建去重的用户和目标谓词", () => {
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

  it("支持分组目标清理", async () => {
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

  it("重试清理直到匹配审计行不存在", async () => {
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
