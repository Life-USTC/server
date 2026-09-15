import { beforeEach, describe, expect, it, vi } from "vitest";

const { logAppEventMock, writeAuditLogsMock, writeQueueBatchAnalyticsMock } =
  vi.hoisted(() => ({
    logAppEventMock: vi.fn(),
    writeAuditLogsMock: vi.fn(),
    writeQueueBatchAnalyticsMock: vi.fn(),
  }));

vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLogs: writeAuditLogsMock,
}));

vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeQueueBatchAnalytics: writeQueueBatchAnalyticsMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

import {
  handleAuditLogWriteBatch,
  parseAuditLogWriteQueueMessage,
} from "@/lib/audit/audit-log-queue";

function queueMessage(body: unknown) {
  return { ack: vi.fn(), body, retry: vi.fn() };
}

describe("audit log write queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects malformed envelopes without passing them to the database", () => {
    expect(parseAuditLogWriteQueueMessage(null)).toBeNull();
    expect(
      parseAuditLogWriteQueueMessage({ type: "audit-log.write.v1" }),
    ).toBeNull();
    expect(
      parseAuditLogWriteQueueMessage({
        type: "audit-log.write.v2",
        auditId: "audit-1",
        params: { action: "account_sign_in" },
      }),
    ).toBeNull();
  });

  it("accepts bounded nested metadata and rejects oversized metadata", () => {
    const bounded = parseAuditLogWriteQueueMessage({
      auditId: "audit-metadata",
      type: "audit-log.write.v1",
      params: {
        action: "account_sign_in",
        metadata: {
          changedFields: ["name", "image"],
          source: "settings",
          nested: { enabled: true },
        },
      },
    });
    expect(bounded?.params.metadata).toEqual({
      changedFields: ["name", "image"],
      nested: { enabled: true },
      source: "settings",
    });

    const tooDeep = { a: { b: { c: { d: { e: "too-deep" } } } } };
    const tooManyEntries = Object.fromEntries(
      Array.from({ length: 65 }, (_, index) => [`key-${index}`, true]),
    );
    const tooLarge = { payload: "x".repeat(8 * 1024) };

    for (const metadata of [tooDeep, tooManyEntries, tooLarge]) {
      expect(
        parseAuditLogWriteQueueMessage({
          auditId: "audit-invalid-metadata",
          type: "audit-log.write.v1",
          params: { action: "account_sign_in", metadata },
        }),
      ).toBeNull();
    }
  });

  it("acks valid writes and retries malformed messages for the DLQ", async () => {
    writeAuditLogsMock.mockResolvedValue(undefined);
    const valid = queueMessage({
      auditId: "audit-1",
      type: "audit-log.write.v1",
      params: { action: "account_sign_in", subjectUserId: "user-1" },
    });
    const invalid = queueMessage({
      type: "unknown",
      secret: "must-not-be-logged",
    });

    const report = await handleAuditLogWriteBatch({
      messages: [valid, invalid],
    });

    expect(writeAuditLogsMock).toHaveBeenCalledWith([
      {
        action: "account_sign_in",
        id: "audit-1",
        subjectUserId: "user-1",
      },
    ]);
    expect(valid.ack).toHaveBeenCalledOnce();
    expect(valid.retry).not.toHaveBeenCalled();
    expect(invalid.ack).not.toHaveBeenCalled();
    expect(invalid.retry).toHaveBeenCalledOnce();
    expect(report.outcome).toBe("partial");
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "audit-log-write.invalid-message",
      {
        event: "audit-log-write.invalid-message",
        phase: "consumer",
        reason: "invalid_envelope",
        source: "audit",
      },
    );
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain(
      "must-not-be-logged",
    );
    expect(writeQueueBatchAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        acked: 1,
        batchSize: 2,
        invalid: 1,
        outcome: "partial",
        processed: 2,
        retried: 1,
      }),
    );
  });

  it("retries transient database failures without acknowledging them", async () => {
    const error = new Error("database unavailable");
    writeAuditLogsMock.mockRejectedValue(error);
    const message = queueMessage({
      auditId: "audit-2",
      type: "audit-log.write.v1",
      params: { action: "comment_create", targetType: "comment" },
    });

    const report = await handleAuditLogWriteBatch({ messages: [message] });

    expect(message.ack).not.toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalledOnce();
    expect(report.outcome).toBe("retry");
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "audit-log-write.retry",
      expect.objectContaining({
        event: "audit-log-write.retry",
        invalidMessageCount: 0,
        messageType: "audit-log.write.v1",
        phase: "consumer",
        reason: "database_write_failed",
        validMessageCount: 1,
      }),
      error,
    );
    expect(writeQueueBatchAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        acked: 0,
        outcome: "retry",
        processed: 1,
        retried: 1,
      }),
    );
  });

  it("classifies an all-invalid batch as retry because nothing was acknowledged", async () => {
    const invalid = queueMessage({ type: "unknown" });

    const report = await handleAuditLogWriteBatch({ messages: [invalid] });

    expect(writeAuditLogsMock).not.toHaveBeenCalled();
    expect(invalid.ack).not.toHaveBeenCalled();
    expect(invalid.retry).toHaveBeenCalledOnce();
    expect(report.outcome).toBe("retry");
    expect(writeQueueBatchAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        acked: 0,
        invalid: 1,
        outcome: "retry",
        processed: 1,
        retried: 1,
      }),
    );
  });

  it("reuses the producer ID when an uncertain delivery is replayed", async () => {
    writeAuditLogsMock.mockResolvedValue(undefined);
    const envelope = {
      auditId: "audit-stable",
      type: "audit-log.write.v1",
      params: { action: "account_sign_in", subjectUserId: "user-1" },
    };

    await handleAuditLogWriteBatch({ messages: [queueMessage(envelope)] });
    await handleAuditLogWriteBatch({ messages: [queueMessage(envelope)] });

    expect(writeAuditLogsMock).toHaveBeenNthCalledWith(1, [
      {
        action: "account_sign_in",
        id: "audit-stable",
        subjectUserId: "user-1",
      },
    ]);
    expect(writeAuditLogsMock).toHaveBeenNthCalledWith(2, [
      {
        action: "account_sign_in",
        id: "audit-stable",
        subjectUserId: "user-1",
      },
    ]);
  });

  it("writes a batch of 20 records once and acknowledges only after commit", async () => {
    let resolveWrite!: () => void;
    writeAuditLogsMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveWrite = resolve;
      }),
    );
    const messages = Array.from({ length: 20 }, (_, index) =>
      queueMessage({
        auditId: `audit-${index}`,
        type: "audit-log.write.v1",
        params: { action: "comment_create", targetType: "comment" },
      }),
    );

    const handling = handleAuditLogWriteBatch({ messages });
    await Promise.resolve();
    expect(writeAuditLogsMock).toHaveBeenCalledOnce();
    expect(writeAuditLogsMock.mock.calls[0]?.[0]).toHaveLength(20);
    expect(
      messages.every((message) => message.ack.mock.calls.length === 0),
    ).toBe(true);

    resolveWrite();
    const report = await handling;
    expect(
      messages.every((message) => message.ack.mock.calls.length === 1),
    ).toBe(true);
    expect(report.outcome).toBe("success");
    expect(writeQueueBatchAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        acked: 20,
        batchSize: 20,
        outcome: "success",
        retried: 0,
      }),
    );
  });
});
