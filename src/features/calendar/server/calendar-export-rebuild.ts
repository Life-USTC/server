import { storeBuiltUserCalendarExport } from "@/features/calendar/server/calendar-export-cache";
import { getUserCalendarRecord } from "@/features/calendar/server/calendar-export-data";
import {
  type CalendarExportRebuildMessage,
  parseCalendarExportRebuildMessage,
} from "@/features/calendar/server/calendar-export-queue";
import { buildUserCalendarExport } from "@/features/calendar/server/calendar-export-service";
import { prisma } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import { writeCalendarExportRebuildAnalytics } from "@/lib/metrics/analytics-engine";

export async function rebuildUserCalendarExport(userId: string) {
  let user: Awaited<ReturnType<typeof getUserCalendarRecord>>;
  try {
    user = await getUserCalendarRecord(userId);
  } catch (error) {
    writeCalendarExportRebuildAnalytics({ status: "refresh_error" });
    throw error;
  }
  if (!user) return null;

  let calendar: Awaited<ReturnType<typeof buildUserCalendarExport>>;
  try {
    calendar = await buildUserCalendarExport(user, userId);
  } catch (error) {
    writeCalendarExportRebuildAnalytics({ status: "refresh_error" });
    throw error;
  }

  return storeBuiltUserCalendarExport(userId, calendar);
}

async function listSectionSubscriberUserIds(sectionId: number) {
  const subscribers = await prisma.userSectionSubscription.findMany({
    where: { sectionId },
    select: { userId: true },
  });
  return subscribers.map((subscriber) => subscriber.userId);
}

export async function collectCalendarExportRebuildUserIds(
  messages: CalendarExportRebuildMessage[],
) {
  const userIds = new Set<string>();
  const sectionIds = new Set<number>();

  for (const message of messages) {
    if (message.type === "user") {
      userIds.add(message.userId);
      continue;
    }
    sectionIds.add(message.sectionId);
  }

  for (const sectionId of sectionIds) {
    for (const userId of await listSectionSubscriberUserIds(sectionId)) {
      userIds.add(userId);
    }
  }

  return [...userIds];
}

export async function processCalendarExportRebuildMessage(
  message: CalendarExportRebuildMessage,
) {
  await processCalendarExportRebuildMessages([message]);
}

export async function processCalendarExportRebuildMessages(
  messages: CalendarExportRebuildMessage[],
) {
  const userIds = await collectCalendarExportRebuildUserIds(messages);
  for (const userId of userIds) {
    try {
      await rebuildUserCalendarExport(userId);
      writeCalendarExportRebuildAnalytics({ status: "ok" });
    } catch (error) {
      writeCalendarExportRebuildAnalytics({ status: "error" });
      throw error;
    }
  }
}

export type CalendarExportRebuildQueueMessage = {
  ack(): void;
  body: unknown;
  retry(): void;
};

export type CalendarExportRebuildQueueBatch = {
  messages: readonly CalendarExportRebuildQueueMessage[];
};

/**
 * Worker queue entrypoint: parse, coalesce, rebuild, ack/retry per message.
 */
export async function handleCalendarExportRebuildBatch(
  batch: CalendarExportRebuildQueueBatch,
) {
  const parsed: CalendarExportRebuildMessage[] = [];
  const validMessages: CalendarExportRebuildQueueMessage[] = [];

  for (const message of batch.messages) {
    const body = parseCalendarExportRebuildMessage(message.body);
    if (!body) {
      message.ack();
      continue;
    }
    parsed.push(body);
    validMessages.push(message);
  }

  if (parsed.length === 0) return;

  try {
    await processCalendarExportRebuildMessages(parsed);
    for (const message of validMessages) {
      message.ack();
    }
  } catch (error) {
    logAppEvent(
      "error",
      "calendar-export-rebuild.retry",
      {
        batchMessageCount: batch.messages.length,
        event: "calendar-export-rebuild.retry",
        messageType: "calendar-export-rebuild",
        retryCount: validMessages.length,
        source: "calendar-export-rebuild",
        validMessageCount: validMessages.length,
      },
      error,
    );
    for (const message of validMessages) {
      message.retry();
    }
  }
}
