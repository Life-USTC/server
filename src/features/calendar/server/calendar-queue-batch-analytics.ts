import { getCloudflareAnalyticsEngineDataset } from "@/lib/adapters/cloudflare-runtime";
import { logAppEvent } from "@/lib/log/app-logger";
import { getSafeErrorName } from "@/lib/log/safe-error-name";

export type CalendarQueueBatchOutcome =
  | "error"
  | "partial"
  | "retry"
  | "success";

/**
 * The numeric field order is part of the Analytics Engine contract. Keep this
 * list in sync with the doubles array in writeCalendarQueueBatchAnalytics.
 */
export const CALENDAR_QUEUE_BATCH_ANALYTICS_DOUBLE_FIELDS = [
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
] as const;

export type CalendarQueueBatchAnalyticsInput = {
  ackedMessageCount: number;
  durationMs: number;
  inputMessageCount: number;
  invalidMessageCount: number;
  maxAgeMs: number;
  maxAttempts: number;
  noOpMessageCount: number;
  noSubscriberMessageCount: number;
  outcome: CalendarQueueBatchOutcome;
  /** Completed rebuild attempts for distinct users, including deleted users. */
  processedUserCount: number;
  retriedMessageCount: number;
  sectionMessageCount: number;
  /** Distinct users coalesced from direct messages and section fan-out. */
  uniqueUserRebuildCount: number;
  userMessageCount: number;
};

const CALENDAR_QUEUE_NAME = "calendar";
const CALENDAR_QUEUE_BATCH_EVENT = "calendar_queue_batch_v1";
const CALENDAR_QUEUE_BATCH_EVENT_PHASE = "finish";
const MAX_COUNT = 1_000_000;

function boundedMetric(value: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, value), MAX_COUNT);
}

function normalizeOutcome(value: unknown): CalendarQueueBatchOutcome {
  return value === "error" ||
    value === "partial" ||
    value === "retry" ||
    value === "success"
    ? value
    : "error";
}

function logAnalyticsFailure(error: unknown) {
  try {
    logAppEvent("error", "calendar-queue-batch.analytics-failed", {
      errorName: getSafeErrorName(error),
      event: "calendar-queue-batch.analytics-failed",
      source: "calendar-export-rebuild",
    });
  } catch {
    // Analytics diagnostics must never affect queue processing.
  }
}

/**
 * Write one fixed, low-cardinality datapoint for one calendar consumer batch.
 *
 * The writer is deliberately feature-owned instead of extending the shared
 * queue schema: calendar fan-out counts describe users, while queue ack/retry
 * counts describe messages. Keeping both in one versioned datapoint prevents
 * the per-user `calendar_export_rebuild.ok` event from being misread as a
 * message completion counter.
 */
export function writeCalendarQueueBatchAnalytics(
  input: CalendarQueueBatchAnalyticsInput,
) {
  try {
    const dataset = getCloudflareAnalyticsEngineDataset();
    if (
      !dataset ||
      typeof dataset !== "object" ||
      typeof dataset.writeDataPoint !== "function"
    ) {
      return;
    }

    dataset.writeDataPoint({
      indexes: ["queue:calendar"],
      blobs: [
        CALENDAR_QUEUE_BATCH_EVENT,
        CALENDAR_QUEUE_BATCH_EVENT_PHASE,
        CALENDAR_QUEUE_NAME,
        normalizeOutcome(input.outcome),
      ],
      doubles: [
        boundedMetric(input.durationMs),
        boundedMetric(input.inputMessageCount),
        boundedMetric(input.userMessageCount),
        boundedMetric(input.sectionMessageCount),
        boundedMetric(input.uniqueUserRebuildCount),
        boundedMetric(input.noSubscriberMessageCount),
        boundedMetric(input.noOpMessageCount),
        boundedMetric(input.processedUserCount),
        boundedMetric(input.ackedMessageCount),
        boundedMetric(input.retriedMessageCount),
        boundedMetric(input.invalidMessageCount),
        boundedMetric(input.maxAgeMs),
        boundedMetric(input.maxAttempts),
      ],
    });
  } catch (error) {
    logAnalyticsFailure(error);
  }
}
