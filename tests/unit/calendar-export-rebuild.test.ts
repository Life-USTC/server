import { afterEach, describe, expect, it, vi } from "vitest";

const {
  findManyMock,
  getUserCalendarRecordMock,
  buildUserCalendarExportMock,
  logAppEventMock,
  storeBuiltUserCalendarExportMock,
  writeCalendarQueueBatchAnalyticsMock,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  getUserCalendarRecordMock: vi.fn(),
  buildUserCalendarExportMock: vi.fn(),
  logAppEventMock: vi.fn(),
  storeBuiltUserCalendarExportMock: vi.fn(),
  writeCalendarQueueBatchAnalyticsMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userSectionSubscription: {
      findMany: findManyMock,
    },
  },
}));

vi.mock("@/features/calendar/server/calendar-export-data", () => ({
  getUserCalendarRecord: getUserCalendarRecordMock,
}));

vi.mock("@/features/calendar/server/calendar-export-service", () => ({
  buildUserCalendarExport: buildUserCalendarExportMock,
}));

vi.mock("@/features/calendar/server/calendar-export-cache", () => ({
  storeBuiltUserCalendarExport: storeBuiltUserCalendarExportMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

vi.mock("@/features/calendar/server/calendar-queue-batch-analytics", () => ({
  writeCalendarQueueBatchAnalytics: writeCalendarQueueBatchAnalyticsMock,
}));

import {
  collectCalendarExportRebuildUserIds,
  handleCalendarExportRebuildBatch,
  processCalendarExportRebuildMessages,
} from "@/features/calendar/server/calendar-export-rebuild";

describe("calendar export rebuild fan-out", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("coalesces duplicate user ids across user and section messages", async () => {
    findManyMock.mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
      { userId: "user-1" },
    ]);

    const userIds = await collectCalendarExportRebuildUserIds([
      { type: "user", userId: "user-1" },
      { type: "user", userId: "user-3" },
      { type: "section", sectionId: 10 },
      { type: "section", sectionId: 10 },
    ]);

    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { sectionId: 10 },
      select: { userId: true },
    });
    expect(userIds.sort()).toEqual(["user-1", "user-2", "user-3"]);
  });

  it("rebuilds each coalesced user once for a mixed batch", async () => {
    findManyMock.mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    getUserCalendarRecordMock.mockImplementation(async (userId: string) => ({
      id: userId,
      sectionSubscriptions: [],
      todos: [],
    }));
    buildUserCalendarExportMock.mockResolvedValue({
      cacheControl: "private, max-age=1800",
      filename: "life-ustc-subscriptions.ics",
      text: "BEGIN:VCALENDAR\nEND:VCALENDAR",
    });
    storeBuiltUserCalendarExportMock.mockResolvedValue({
      cacheControl: "private, max-age=1800",
      etag: '"etag"',
      filename: "life-ustc-subscriptions.ics",
      generatedAtMs: Date.now(),
      text: "BEGIN:VCALENDAR\nEND:VCALENDAR",
      version: 1,
    });

    await processCalendarExportRebuildMessages([
      { type: "user", userId: "user-1" },
      { type: "section", sectionId: 5 },
    ]);

    expect(getUserCalendarRecordMock).toHaveBeenCalledTimes(2);
    expect(getUserCalendarRecordMock).toHaveBeenCalledWith("user-1");
    expect(getUserCalendarRecordMock).toHaveBeenCalledWith("user-2");
    expect(storeBuiltUserCalendarExportMock).toHaveBeenCalledTimes(2);
  });

  it("records coalescing-aware counts once for a successful batch", async () => {
    findManyMock.mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    getUserCalendarRecordMock.mockResolvedValue({
      id: "user-1",
      sectionSubscriptions: [],
      todos: [],
    });
    buildUserCalendarExportMock.mockResolvedValue({
      cacheControl: "private, max-age=1800",
      filename: "life-ustc-subscriptions.ics",
      text: "BEGIN:VCALENDAR\nEND:VCALENDAR",
    });
    storeBuiltUserCalendarExportMock.mockResolvedValue({});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T00:00:10.000Z"));

    const user = {
      ack: vi.fn(),
      attempts: 2,
      body: { type: "user", userId: "user-1" },
      retry: vi.fn(),
      timestamp: new Date("2026-08-27T00:00:00.000Z"),
    };
    const section = {
      ack: vi.fn(),
      attempts: 1,
      body: { type: "section", sectionId: 5 },
      retry: vi.fn(),
      timestamp: new Date("2026-08-27T00:00:05.000Z"),
    };

    await expect(
      handleCalendarExportRebuildBatch({ messages: [user, section] }),
    ).resolves.toEqual({ outcome: "success" });

    expect(writeCalendarQueueBatchAnalyticsMock).toHaveBeenCalledOnce();
    expect(writeCalendarQueueBatchAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ackedMessageCount: 2,
        inputMessageCount: 2,
        invalidMessageCount: 0,
        maxAgeMs: 10_000,
        maxAttempts: 2,
        noOpMessageCount: 0,
        noSubscriberMessageCount: 0,
        outcome: "success",
        processedUserCount: 2,
        retriedMessageCount: 0,
        sectionMessageCount: 1,
        uniqueUserRebuildCount: 2,
        userMessageCount: 1,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("counts each no-subscriber section message as a no-op", async () => {
    findManyMock.mockResolvedValue([]);
    const first = {
      ack: vi.fn(),
      body: { type: "section", sectionId: 99 },
      retry: vi.fn(),
    };
    const second = {
      ack: vi.fn(),
      body: { type: "section", sectionId: 99 },
      retry: vi.fn(),
    };

    await expect(
      handleCalendarExportRebuildBatch({ messages: [first, second] }),
    ).resolves.toEqual({ outcome: "success" });

    expect(writeCalendarQueueBatchAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ackedMessageCount: 2,
        inputMessageCount: 2,
        noOpMessageCount: 2,
        noSubscriberMessageCount: 2,
        processedUserCount: 0,
        sectionMessageCount: 2,
        uniqueUserRebuildCount: 0,
        userMessageCount: 0,
      }),
    );
  });

  it("acks valid messages and sends invalid envelopes toward the DLQ", async () => {
    findManyMock.mockResolvedValue([]);
    getUserCalendarRecordMock.mockResolvedValue(null);

    const valid = {
      ack: vi.fn(),
      body: { type: "user", userId: "user-1" },
      retry: vi.fn(),
    };
    const invalid = {
      ack: vi.fn(),
      body: { type: "nope" },
      retry: vi.fn(),
    };

    const report = await handleCalendarExportRebuildBatch({
      messages: [valid, invalid],
    });

    expect(invalid.ack).not.toHaveBeenCalled();
    expect(invalid.retry).toHaveBeenCalledOnce();
    expect(valid.ack).toHaveBeenCalledOnce();
    expect(valid.retry).not.toHaveBeenCalled();
    expect(report).toEqual({ outcome: "partial" });
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "calendar-export-rebuild.invalid-message",
      {
        event: "calendar-export-rebuild.invalid-message",
        phase: "consumer",
        reason: "invalid_envelope",
        source: "calendar-export-rebuild",
      },
    );
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain("nope");
    expect(writeCalendarQueueBatchAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ackedMessageCount: 1,
        inputMessageCount: 2,
        invalidMessageCount: 1,
        outcome: "partial",
        retriedMessageCount: 1,
        userMessageCount: 1,
      }),
    );
  });

  it("logs safe batch context before retrying a failed batch", async () => {
    findManyMock.mockResolvedValue([{ userId: "subscriber-secret" }]);
    getUserCalendarRecordMock.mockRejectedValue(
      new Error("failure for user-secret"),
    );
    const userMessage = {
      ack: vi.fn(),
      body: { type: "user", userId: "user-secret" },
      retry: vi.fn(),
    };
    const sectionMessage = {
      ack: vi.fn(),
      body: { type: "section", sectionId: 987654 },
      retry: vi.fn(),
    };

    const report = await handleCalendarExportRebuildBatch({
      messages: [userMessage, sectionMessage],
    });

    expect(userMessage.ack).not.toHaveBeenCalled();
    expect(sectionMessage.ack).not.toHaveBeenCalled();
    expect(userMessage.retry).toHaveBeenCalledOnce();
    expect(sectionMessage.retry).toHaveBeenCalledOnce();
    expect(report).toEqual({ outcome: "retry" });
    expect(logAppEventMock).toHaveBeenCalledOnce();
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "calendar-export-rebuild.retry",
      {
        batchMessageCount: 2,
        event: "calendar-export-rebuild.retry",
        messageType: "calendar-export-rebuild",
        retryCount: 2,
        source: "calendar-export-rebuild",
        validMessageCount: 2,
      },
      expect.any(Error),
    );
    expect(logAppEventMock.mock.calls[0]?.[2]).not.toHaveProperty("userId");
    expect(logAppEventMock.mock.calls[0]?.[2]).not.toHaveProperty("sectionId");
    expect(writeCalendarQueueBatchAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ackedMessageCount: 0,
        inputMessageCount: 2,
        invalidMessageCount: 0,
        outcome: "retry",
        processedUserCount: 0,
        retriedMessageCount: 2,
        uniqueUserRebuildCount: 2,
        userMessageCount: 1,
        sectionMessageCount: 1,
      }),
    );
  });

  it("classifies an all-invalid batch as retry without sampling it as success", async () => {
    const invalid = {
      ack: vi.fn(),
      body: { type: "nope" },
      retry: vi.fn(),
    };

    await expect(
      handleCalendarExportRebuildBatch({ messages: [invalid] }),
    ).resolves.toEqual({ outcome: "retry" });
    expect(invalid.ack).not.toHaveBeenCalled();
    expect(invalid.retry).toHaveBeenCalledOnce();
    expect(writeCalendarQueueBatchAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ackedMessageCount: 0,
        inputMessageCount: 1,
        invalidMessageCount: 1,
        noOpMessageCount: 0,
        noSubscriberMessageCount: 0,
        outcome: "retry",
        processedUserCount: 0,
        retriedMessageCount: 1,
      }),
    );
  });

  it("classifies an all-valid batch as success after acknowledging once", async () => {
    findManyMock.mockResolvedValue([]);
    getUserCalendarRecordMock.mockResolvedValue(null);
    const valid = {
      ack: vi.fn(),
      body: { type: "user", userId: "user-1" },
      retry: vi.fn(),
    };

    await expect(
      handleCalendarExportRebuildBatch({ messages: [valid] }),
    ).resolves.toEqual({ outcome: "success" });
    expect(valid.ack).toHaveBeenCalledOnce();
    expect(valid.retry).not.toHaveBeenCalled();
    expect(writeCalendarQueueBatchAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ackedMessageCount: 1,
        inputMessageCount: 1,
        invalidMessageCount: 0,
        noOpMessageCount: 1,
        noSubscriberMessageCount: 0,
        outcome: "success",
        processedUserCount: 1,
        retriedMessageCount: 0,
        uniqueUserRebuildCount: 1,
        userMessageCount: 1,
      }),
    );
  });

  it("classifies an empty batch as a successful no-op", async () => {
    await expect(
      handleCalendarExportRebuildBatch({ messages: [] }),
    ).resolves.toEqual({ outcome: "success" });
    expect(writeCalendarQueueBatchAnalyticsMock).toHaveBeenCalledOnce();
    expect(writeCalendarQueueBatchAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ackedMessageCount: 0,
        inputMessageCount: 0,
        invalidMessageCount: 0,
        outcome: "success",
        processedUserCount: 0,
        retriedMessageCount: 0,
      }),
    );
  });
});
