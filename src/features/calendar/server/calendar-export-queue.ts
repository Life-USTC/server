import { getCloudflareCalendarExportRebuildQueue } from "@/lib/adapters/cloudflare-runtime";
import { writeCalendarExportRebuildAnalytics } from "@/lib/metrics/analytics-engine";

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
  if (queue) {
    await queue.send(message);
    writeCalendarExportRebuildAnalytics({ status: "enqueued" });
    return;
  }

  // Node / vitest without a Queue binding: rebuild in-process.
  const { processCalendarExportRebuildMessage } = await import(
    "./calendar-export-rebuild"
  );
  await processCalendarExportRebuildMessage(message);
  writeCalendarExportRebuildAnalytics({ status: "enqueued" });
}

export async function enqueueUserCalendarExportRebuild(userId: string) {
  const trimmed = userId.trim();
  if (!trimmed) return;
  await deliverCalendarExportRebuildMessage({ type: "user", userId: trimmed });
}

export async function enqueueSectionCalendarExportRebuild(sectionId: number) {
  if (!Number.isInteger(sectionId) || sectionId <= 0) return;
  await deliverCalendarExportRebuildMessage({ type: "section", sectionId });
}

export function scheduleUserCalendarExportRebuild(userId: string) {
  void enqueueUserCalendarExportRebuild(userId).catch(() => {
    // Enqueue failures must not fail the write path.
  });
}

export function scheduleSectionCalendarExportRebuild(sectionId: number) {
  void enqueueSectionCalendarExportRebuild(sectionId).catch(() => {
    // Enqueue failures must not fail the write path.
  });
}
