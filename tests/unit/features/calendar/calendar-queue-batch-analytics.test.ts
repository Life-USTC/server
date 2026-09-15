import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CALENDAR_QUEUE_BATCH_ANALYTICS_DOUBLE_FIELDS,
  writeCalendarQueueBatchAnalytics,
} from "@/features/calendar/server/calendar-queue-batch-analytics";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const { emitLogMock } = vi.hoisted(() => ({
  emitLogMock: vi.fn(),
}));

vi.mock("@/lib/log/app-log-emitter", () => ({
  emitLog: emitLogMock,
}));

const baseInput = {
  ackedMessageCount: 2,
  durationMs: 17.5,
  inputMessageCount: 3,
  invalidMessageCount: 1,
  maxAgeMs: 125,
  maxAttempts: 2,
  noOpMessageCount: 1,
  noSubscriberMessageCount: 1,
  outcome: "partial" as const,
  processedUserCount: 2,
  retriedMessageCount: 1,
  sectionMessageCount: 1,
  uniqueUserRebuildCount: 2,
  userMessageCount: 1,
};

describe("calendar queue batch analytics", () => {
  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
    emitLogMock.mockReset();
    vi.restoreAllMocks();
  });

  it("writes one fixed low-cardinality datapoint with the documented field order", () => {
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });

    writeCalendarQueueBatchAnalytics(baseInput);

    expect(writeDataPoint).toHaveBeenCalledOnce();
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["queue:calendar"],
      blobs: ["calendar_queue_batch_v1", "finish", "calendar", "partial"],
      doubles: [17.5, 3, 1, 1, 2, 1, 1, 2, 2, 1, 1, 125, 2],
    });
    expect(CALENDAR_QUEUE_BATCH_ANALYTICS_DOUBLE_FIELDS).toEqual([
      "durationMs",
      "inputMessageCount",
      "userMessageCount",
      "sectionMessageCount",
      "uniqueUserRebuildCount",
      "noSubscriberMessageCount",
      "noOpMessageCount",
      "processedUserCount",
      "ackedMessageCount",
      "retriedMessageCount",
      "invalidMessageCount",
      "maxAgeMs",
      "maxAttempts",
    ]);
  });

  it("keeps untrusted values out of the finite schema and datapoint limits", () => {
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });
    const secret = "user-secret-or-section-secret";

    writeCalendarQueueBatchAnalytics({
      ...baseInput,
      ackedMessageCount: Number.NaN,
      durationMs: Number.POSITIVE_INFINITY,
      inputMessageCount: 2_000_000,
      invalidMessageCount: -10,
      maxAgeMs: Number.NEGATIVE_INFINITY,
      maxAttempts: Number.NaN,
      noOpMessageCount: 2_000_000,
      noSubscriberMessageCount: 2_000_000,
      outcome: secret as never,
      processedUserCount: 2_000_000,
      retriedMessageCount: 2_000_000,
      sectionMessageCount: 2_000_000,
      uniqueUserRebuildCount: 2_000_000,
      userMessageCount: 2_000_000,
    });

    const [dataPoint] = writeDataPoint.mock.calls[0] ?? [];
    expect(dataPoint.indexes).toHaveLength(1);
    expect(dataPoint.blobs).toHaveLength(4);
    expect(dataPoint.doubles).toHaveLength(
      CALENDAR_QUEUE_BATCH_ANALYTICS_DOUBLE_FIELDS.length,
    );
    expect(dataPoint.blobs).toEqual([
      "calendar_queue_batch_v1",
      "finish",
      "calendar",
      "error",
    ]);
    expect(dataPoint.doubles.every(Number.isFinite)).toBe(true);
    expect(dataPoint.doubles.every((value: number) => value >= 0)).toBe(true);
    expect(dataPoint.doubles).toContain(1_000_000);
    expect(JSON.stringify(dataPoint)).not.toContain(secret);
  });

  it("fails open when the Analytics Engine binding throws without logging the error body", () => {
    const writeDataPoint = vi.fn(() => {
      throw new Error("private analytics transport detail");
    });
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });

    expect(() => writeCalendarQueueBatchAnalytics(baseInput)).not.toThrow();
    expect(emitLogMock).toHaveBeenCalledWith(
      "[app]",
      "error",
      expect.objectContaining({
        errorName: "Error",
        event: "calendar-queue-batch.analytics-failed",
        source: "calendar-export-rebuild",
      }),
      undefined,
    );
    expect(JSON.stringify(emitLogMock.mock.calls)).not.toContain(
      "private analytics transport detail",
    );
  });

  it("does nothing when Analytics Engine is unavailable", () => {
    expect(() => writeCalendarQueueBatchAnalytics(baseInput)).not.toThrow();
    expect(emitLogMock).not.toHaveBeenCalled();
  });
});
