import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../shared/deferred";

const { getAuditQueueMock, getTaskSchedulerMock, logAppEventMock, prismaMock } =
  vi.hoisted(() => ({
    getAuditQueueMock: vi.fn(),
    getTaskSchedulerMock: vi.fn(),
    logAppEventMock: vi.fn(),
    prismaMock: {
      auditLog: {
        createMany: vi.fn(),
      },
    },
  }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/adapters/cloudflare-runtime", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/adapters/cloudflare-runtime")
  >()),
  getCloudflareAuditLogWriteQueue: getAuditQueueMock,
  getCloudflareRuntimeTaskScheduler: getTaskSchedulerMock,
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
    getAuditQueueMock.mockReset();
    getTaskSchedulerMock.mockReset();
    logAppEventMock.mockReset();
    prismaMock.auditLog.createMany.mockReset();
    vi.resetModules();
  });

  it("generates one stable ID in the producer envelope", async () => {
    const queueSend = vi.fn().mockResolvedValue(undefined);
    getAuditQueueMock.mockReturnValue({ send: queueSend });
    const { fireAuditLog } = await import("@/lib/audit/write-audit-log");

    await fireAuditLog(auditParams);

    expect(queueSend).toHaveBeenCalledOnce();
    expect(queueSend).toHaveBeenCalledWith({
      auditId: expect.any(String),
      params: auditParams,
      type: "audit-log.write.v1",
    });
    expect(prismaMock.auditLog.createMany).not.toHaveBeenCalled();
    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "audit-log.enqueue.success",
      {
        action: "comment_create",
        event: "audit-log.enqueue.success",
        outcome: "success",
        phase: "enqueue",
        source: "audit",
        targetType: "comment",
      },
    );
  });

  it("records queue enqueue failures separately without changing route semantics", async () => {
    const enqueueError = new Error("queue unavailable");
    getAuditQueueMock.mockReturnValue({
      send: vi.fn().mockRejectedValue(enqueueError),
    });
    const { fireAuditLog } = await import("@/lib/audit/write-audit-log");

    await expect(fireAuditLog(auditParams)).resolves.toBeUndefined();

    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "audit-log.enqueue.failure",
      {
        action: "comment_create",
        event: "audit-log.enqueue.failure",
        outcome: "failure",
        phase: "enqueue",
        source: "audit",
        targetType: "comment",
      },
      enqueueError,
    );
    expect(prismaMock.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("treats a replayed producer ID as an idempotent audit write", async () => {
    prismaMock.auditLog.createMany.mockResolvedValue(undefined);
    const { writeAuditLog } = await import("@/lib/audit/write-audit-log");

    await writeAuditLog({ ...auditParams, id: "audit-stable" });

    expect(prismaMock.auditLog.createMany).toHaveBeenCalledWith({
      data: { ...auditParams, id: "audit-stable" },
      skipDuplicates: true,
    });
  });

  it("在调度 Worker waitUntil 后完成，无需等待审计写入", async () => {
    const waitUntilMock = vi.fn();
    getTaskSchedulerMock.mockReturnValue(waitUntilMock);
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
    });

    auditWrite.resolve({});
    await waitUntilMock.mock.calls[0]?.[0];

    expect(logAppEventMock).not.toHaveBeenCalled();
  });

  it("记录已调度审计写入失败", async () => {
    const writeError = new Error("database unavailable");
    const waitUntilMock = vi.fn();
    getTaskSchedulerMock.mockReturnValue(waitUntilMock);
    prismaMock.auditLog.createMany.mockRejectedValueOnce(writeError);
    const { fireAuditLog } = await import("@/lib/audit/write-audit-log");

    fireAuditLog(auditParams);
    await vi.dynamicImportSettled();
    await vi.waitFor(() => expect(waitUntilMock).toHaveBeenCalledTimes(1));
    await waitUntilMock.mock.calls[0]?.[0];

    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "audit-log.write.failure",
      expect.objectContaining({
        event: "audit-log.write.failure",
        outcome: "failure",
        phase: "database",
        action: "comment_create",
        source: "audit",
        targetType: "comment",
      }),
      writeError,
    );
  });

  it("当 waitUntil 不可用时等待审计写入", async () => {
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
