import { writeCalendarExportRebuildAnalytics } from "@/lib/metrics/analytics-engine";
import {
  getCloudflareCalendarExportRebuildQueue,
  getCloudflareRuntimeTaskScheduler,
} from "@/lib/ports/runtime";

export type CalendarExportRebuildUserMessage = {
  type: "user";
  userId: string;
};

export type CalendarExportRebuildSectionMessage = {
  type: "section";
  sectionId: number;
};

export type CalendarExportRebuildMessage =
  | CalendarExportRebuildUserMessage
  | CalendarExportRebuildSectionMessage;

type CalendarExportRebuildSender = (
  message: CalendarExportRebuildMessage,
) => Promise<void>;

let senderForTest: CalendarExportRebuildSender | undefined;

export function setCalendarExportRebuildSenderForTest(
  sender?: CalendarExportRebuildSender,
) {
  senderForTest = sender;
}

export function parseCalendarExportRebuildMessage(
  value: unknown,
): CalendarExportRebuildMessage | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<CalendarExportRebuildMessage>;
  if (
    entry.type === "user" &&
    typeof entry.userId === "string" &&
    entry.userId
  ) {
    return { type: "user", userId: entry.userId };
  }
  if (
    entry.type === "section" &&
    typeof entry.sectionId === "number" &&
    Number.isInteger(entry.sectionId) &&
    entry.sectionId > 0
  ) {
    return { type: "section", sectionId: entry.sectionId };
  }
  return null;
}

async function deliverCalendarExportRebuildMessage(
  message: CalendarExportRebuildMessage,
) {
  if (senderForTest) {
    await senderForTest(message);
    writeCalendarExportRebuildAnalytics({ status: "enqueued" });
    return;
  }

  const queue = getCloudflareCalendarExportRebuildQueue();
  if (!queue) {
    throw new Error("CALENDAR_EXPORT_REBUILD binding is required");
  }

  await queue.send(message);
  writeCalendarExportRebuildAnalytics({ status: "enqueued" });
}

function recordCalendarExportRebuildEnqueueFailure() {
  writeCalendarExportRebuildAnalytics({ status: "enqueue_error" });
}

function observeEnqueueFailure(enqueue: Promise<void>) {
  enqueue.catch(() => {
    // The enqueue function records the low-cardinality failure metric before
    // rethrowing. This rejection handler keeps no-defer callers from creating
    // an unhandled rejection while preserving immediate stale responses.
  });
}

export async function enqueueUserCalendarExportRebuild(userId: string) {
  const trimmed = userId.trim();
  if (!trimmed) return;
  try {
    await deliverCalendarExportRebuildMessage({
      type: "user",
      userId: trimmed,
    });
  } catch (error) {
    recordCalendarExportRebuildEnqueueFailure();
    throw error;
  }
}

export async function enqueueSectionCalendarExportRebuild(sectionId: number) {
  if (!Number.isInteger(sectionId) || sectionId <= 0) return;
  try {
    await deliverCalendarExportRebuildMessage({ type: "section", sectionId });
  } catch (error) {
    recordCalendarExportRebuildEnqueueFailure();
    throw error;
  }
}

export function scheduleUserCalendarExportRebuild(
  userId: string,
  defer:
    | ((promise: Promise<unknown>) => void)
    | undefined = getCloudflareRuntimeTaskScheduler(),
) {
  const enqueue = enqueueUserCalendarExportRebuild(userId);
  if (defer) {
    try {
      defer(enqueue);
      return;
    } catch {
      // A failed scheduler cannot retain the promise. Attach a rejection
      // observer so the write path remains non-blocking and the enqueue
      // failure remains visible through its metric.
    }
  }
  observeEnqueueFailure(enqueue);
}

export function scheduleSectionCalendarExportRebuild(
  sectionId: number,
  defer:
    | ((promise: Promise<unknown>) => void)
    | undefined = getCloudflareRuntimeTaskScheduler(),
) {
  const enqueue = enqueueSectionCalendarExportRebuild(sectionId);
  if (defer) {
    try {
      defer(enqueue);
      return;
    } catch {
      // See the user-scoped scheduler path above.
    }
  }
  observeEnqueueFailure(enqueue);
}
