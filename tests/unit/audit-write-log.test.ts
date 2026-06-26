import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getRequestEventMock,
  logAppEventMock,
  prismaMock,
  recordAuditWriteMetricMock,
} = vi.hoisted(() => ({
  getRequestEventMock: vi.fn(),
  logAppEventMock: vi.fn(),
  prismaMock: {
    auditLog: {
      create: vi.fn(),
    },
  },
  recordAuditWriteMetricMock: vi.fn(),
}));

vi.mock("$app/server", () => ({
  getRequestEvent: getRequestEventMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

vi.mock("@/lib/metrics/observability-metrics", () => ({
  recordAuditWriteMetric: recordAuditWriteMetricMock,
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
    logAppEventMock.mockReset();
    prismaMock.auditLog.create.mockReset();
    recordAuditWriteMetricMock.mockReset();
    vi.resetModules();
  });

  it("schedules audit writes on the active Worker request context", async () => {
    const waitUntilMock = vi.fn();
    getRequestEventMock.mockReturnValue({
      platform: {
        ctx: {
          waitUntil: waitUntilMock,
        },
      },
    });
    prismaMock.auditLog.create.mockResolvedValue({});
    const { fireAuditLog } = await import("@/lib/audit/write-audit-log");

    const result = fireAuditLog(auditParams);

    expect(result).toBeUndefined();
    expect(waitUntilMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: auditParams,
    });

    await waitUntilMock.mock.calls[0]?.[0];

    expect(recordAuditWriteMetricMock).toHaveBeenCalledWith({
      action: "comment_create",
      durationMs: expect.any(Number),
      status: "success",
    });
    expect(logAppEventMock).not.toHaveBeenCalled();
  });

  it("logs scheduled audit write failures", async () => {
    const writeError = new Error("database unavailable");
    const waitUntilMock = vi.fn();
    getRequestEventMock.mockReturnValue({
      platform: {
        ctx: {
          waitUntil: waitUntilMock,
        },
      },
    });
    prismaMock.auditLog.create.mockRejectedValueOnce(writeError);
    const { fireAuditLog } = await import("@/lib/audit/write-audit-log");

    fireAuditLog(auditParams);
    await waitUntilMock.mock.calls[0]?.[0];

    expect(recordAuditWriteMetricMock).toHaveBeenCalledWith({
      action: "comment_create",
      durationMs: expect.any(Number),
      status: "error",
    });
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "Audit log write failed",
      {
        action: "comment_create",
        source: "audit",
        targetId: "comment-1",
        userId: "user-1",
      },
      writeError,
    );
  });

  it("returns the audit write promise when waitUntil is unavailable", async () => {
    getRequestEventMock.mockImplementation(() => {
      throw new Error("outside request");
    });
    prismaMock.auditLog.create.mockResolvedValue({});
    const { fireAuditLog } = await import("@/lib/audit/write-audit-log");

    const result = fireAuditLog(auditParams);

    expect(result).toHaveProperty("then");
    await expect(result).resolves.toBeUndefined();
    expect(logAppEventMock).not.toHaveBeenCalled();
  });
});
