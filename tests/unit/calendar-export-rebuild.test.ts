import { afterEach, describe, expect, it, vi } from "vitest";

const {
  findManyMock,
  getUserCalendarRecordMock,
  buildUserCalendarExportMock,
  logAppEventMock,
  storeBuiltUserCalendarExportMock,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  getUserCalendarRecordMock: vi.fn(),
  buildUserCalendarExportMock: vi.fn(),
  logAppEventMock: vi.fn(),
  storeBuiltUserCalendarExportMock: vi.fn(),
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

import {
  collectCalendarExportRebuildUserIds,
  handleCalendarExportRebuildBatch,
  processCalendarExportRebuildMessages,
} from "@/features/calendar/server/calendar-export-rebuild";

describe("calendar export rebuild fan-out", () => {
  afterEach(() => {
    vi.clearAllMocks();
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
  });

  it("classifies an empty batch as a successful no-op", async () => {
    await expect(
      handleCalendarExportRebuildBatch({ messages: [] }),
    ).resolves.toEqual({ outcome: "success" });
  });
});
