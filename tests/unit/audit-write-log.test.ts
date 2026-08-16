import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../shared/deferred";

const { getAuditQueueMock, getRequestEventMock, logAppEventMock, prismaMock } =
  vi.hoisted(() => ({
    getAuditQueueMock: vi.fn(),
    getRequestEventMock: vi.fn(),
    logAppEventMock: vi.fn(),
    prismaMock: {
      auditLog: {
        createMany: vi.fn(),
      },
    },
  }));

vi.mock("$app/server", () => ({
  getRequestEvent: getRequestEventMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/adapters/cloudflare-runtime", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/adapters/cloudflare-runtime")
  >()),
  getCloudflareAuditLogWriteQueue: getAuditQueueMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

const auditParams = {
  action: "comment_create" as const,
  metadata: { source: "unit-test" },
  targetId: "comment-1",
  targetType: "comment",
  userId: "user-1",
};

describe("fireAuditLog", () => {
  beforeEach(() => {
    getRequestEventMock.mockReset();
    getAuditQueueMock.mockReset();
    logAppEventMock.mockReset();
    prismaMock.auditLog.createMany.mockReset();
    vi.resetModules();
  });

  it("generates one stable ID in the producer envelope", async () => {
    const queueSend = vi.fn().mockResolvedValue(undefined);
    getAuditQueueMock.mockReturnValue({ send: queueSend });
    getRequestEventMock.mockImplementation(() => {
      throw new Error("outside request");
    });
    const { fireAuditLog } = await import("@/lib/audit/write-audit-log");

    await fireAuditLog(auditParams);

    expect(queueSend).toHaveBeenCalledOnce();
    expect(queueSend).toHaveBeenCalledWith({
      auditId: expect.any(String),
      params: auditParams,
      type: "audit-log.write.v1",
    });
    expect(prismaMock.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("在调度 Worker waitUntil 后完成，无需等待审计写入", async () => {
    const waitUntilMock = vi.fn();
    getRequestEventMock.mockReturnValue({
      platform: {
        ctx: {
          waitUntil: waitUntilMock,
        },
      },
    });
    const auditWrite = createDeferred<unknown>();
    prismaMock.auditLog.createMany.mockReturnValue(auditWrite.promise);
    const { fireAuditLog } = await import("@/lib/audit/write-audit-log");

    const result = fireAuditLog(auditParams);
    let schedulingResolved = false;
    void result.then(() => {
      schedulingResolved = true;
    });

    expect(result).toHaveProperty("then");
    await vi.waitFor(() => expect(waitUntilMock).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(schedulingResolved).toBe(true);
    expect(prismaMock.auditLog.createMany).toHaveBeenCalledWith({
      data: auditParams,
      skipDuplicates: true,
    });

    auditWrite.resolve({});
    await waitUntilMock.mock.calls[0]?.[0];

    expect(logAppEventMock).not.toHaveBeenCalled();
  });

  it("记录已调度审计写入失败", async () => {
    const writeError = new Error("database unavailable");
    const waitUntilMock = vi.fn();
    getRequestEventMock.mockReturnValue({
      platform: {
        ctx: {
          waitUntil: waitUntilMock,
        },
      },
    });
    prismaMock.auditLog.createMany.mockRejectedValueOnce(writeError);
    const { fireAuditLog } = await import("@/lib/audit/write-audit-log");

    fireAuditLog(auditParams);
    await vi.dynamicImportSettled();
    await vi.waitFor(() => expect(waitUntilMock).toHaveBeenCalledTimes(1));
    await waitUntilMock.mock.calls[0]?.[0];

    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "Audit log write failed",
      {
        action: "comment_create",
        source: "audit",
        targetType: "comment",
      },
      writeError,
    );
  });

  it("当 waitUntil 不可用时等待审计写入", async () => {
    getRequestEventMock.mockImplementation(() => {
      throw new Error("outside request");
    });
    const auditWrite = createDeferred<unknown>();
    prismaMock.auditLog.createMany.mockReturnValue(auditWrite.promise);
    const { fireAuditLog } = await import("@/lib/audit/write-audit-log");

    const result = fireAuditLog(auditParams);
    let writeResolved = false;
    void result.then(() => {
      writeResolved = true;
    });

    expect(result).toHaveProperty("then");
    await vi.dynamicImportSettled();
    await Promise.resolve();
    expect(writeResolved).toBe(false);

    auditWrite.resolve({});
    await expect(result).resolves.toBeUndefined();
    expect(logAppEventMock).not.toHaveBeenCalled();
  });
});
