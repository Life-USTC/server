import { beforeEach, describe, expect, it, vi } from "vitest";

const { logAppEventMock, writeAuditLogMock } = vi.hoisted(() => ({
  logAppEventMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: writeAuditLogMock,
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
        params: { action: "account_sign_in" },
      }),
    ).toBeNull();
  });

  it("acks valid writes and permanently discards malformed messages", async () => {
    writeAuditLogMock.mockResolvedValue(undefined);
    const valid = queueMessage({
      type: "audit-log.write.v1",
      params: { action: "account_sign_in", subjectUserId: "user-1" },
    });
    const invalid = queueMessage({ type: "unknown" });

    await handleAuditLogWriteBatch({ messages: [valid, invalid] });

    expect(writeAuditLogMock).toHaveBeenCalledWith({
      action: "account_sign_in",
      subjectUserId: "user-1",
    });
    expect(valid.ack).toHaveBeenCalledOnce();
    expect(valid.retry).not.toHaveBeenCalled();
    expect(invalid.ack).toHaveBeenCalledOnce();
  });

  it("retries transient database failures without acknowledging them", async () => {
    const error = new Error("database unavailable");
    writeAuditLogMock.mockRejectedValue(error);
    const message = queueMessage({
      type: "audit-log.write.v1",
      params: { action: "comment_create", targetType: "comment" },
    });

    await handleAuditLogWriteBatch({ messages: [message] });

    expect(message.ack).not.toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalledOnce();
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "audit-log-write.retry",
      expect.objectContaining({
        action: "comment_create",
        event: "audit-log-write.retry",
      }),
      error,
    );
  });
});
