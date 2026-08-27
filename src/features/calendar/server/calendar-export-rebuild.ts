import { storeBuiltUserCalendarExport } from "@/features/calendar/server/calendar-export-cache";
import { getUserCalendarRecord } from "@/features/calendar/server/calendar-export-data";
import {
  type CalendarExportRebuildMessage,
  parseCalendarExportRebuildMessage,
} from "@/features/calendar/server/calendar-export-queue";
import { buildUserCalendarExport } from "@/features/calendar/server/calendar-export-service";
import {
  type CalendarQueueBatchOutcome,
  writeCalendarQueueBatchAnalytics,
} from "@/features/calendar/server/calendar-queue-batch-analytics";
import { prisma } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
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

type CalendarExportRebuildTargets = {
  noSubscriberMessageCount: number;
  userContributionCounts: ReadonlyMap<string, number>;
  userIds: string[];
};

function incrementCount<TKey>(map: Map<TKey, number>, key: TKey, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

async function collectCalendarExportRebuildTargets(
  messages: CalendarExportRebuildMessage[],
): Promise<CalendarExportRebuildTargets> {
  const userIds = new Set<string>();
  const userContributionCounts = new Map<string, number>();
  const sectionIds = new Set<number>();
  const sectionMessageCounts = new Map<number, number>();

  for (const message of messages) {
    if (message.type === "user") {
      userIds.add(message.userId);
      incrementCount(userContributionCounts, message.userId);
      continue;
    }
    sectionIds.add(message.sectionId);
    incrementCount(sectionMessageCounts, message.sectionId);
  }

  let noSubscriberMessageCount = 0;
  for (const sectionId of sectionIds) {
    const subscribers = await listSectionSubscriberUserIds(sectionId);
    if (subscribers.length === 0) {
      noSubscriberMessageCount += sectionMessageCounts.get(sectionId) ?? 0;
    }
    // A section message contributes once for each distinct current subscriber.
    // Keep duplicate subscription rows from inflating original-message counts.
    for (const userId of new Set(subscribers)) {
      userIds.add(userId);
      incrementCount(
        userContributionCounts,
        userId,
        sectionMessageCounts.get(sectionId) ?? 0,
      );
    }
  }

  return {
    noSubscriberMessageCount,
    userContributionCounts,
    userIds: [...userIds],
  };
}

export async function collectCalendarExportRebuildUserIds(
  messages: CalendarExportRebuildMessage[],
) {
  return (await collectCalendarExportRebuildTargets(messages)).userIds;
}

export type CalendarExportRebuildProcessingReport = {
  noOpMessageCount: number;
  noSubscriberMessageCount: number;
  /** Completed rebuild attempts for distinct users, including deleted users. */
  processedUserCount: number;
  /** Distinct users coalesced from direct messages and section fan-out. */
  uniqueUserRebuildCount: number;
};

export async function processCalendarExportRebuildMessage(
  message: CalendarExportRebuildMessage,
) {
  await processCalendarExportRebuildMessages([message]);
}

export async function processCalendarExportRebuildMessages(
  messages: CalendarExportRebuildMessage[],
  progress?: CalendarExportRebuildProcessingReport,
) {
  const targets = await collectCalendarExportRebuildTargets(messages);
  const report: CalendarExportRebuildProcessingReport = {
    noOpMessageCount: targets.noSubscriberMessageCount,
    noSubscriberMessageCount: targets.noSubscriberMessageCount,
    processedUserCount: 0,
    uniqueUserRebuildCount: targets.userIds.length,
  };
  if (progress) Object.assign(progress, report);

  for (const userId of targets.userIds) {
    try {
      const calendar = await rebuildUserCalendarExport(userId);
      // Coalescing intentionally runs one rebuild per distinct user. Keep
      // this count user-based; no-op messages are expanded separately from
      // the original direct/section contributions below.
      report.processedUserCount += 1;
      if (calendar === null) {
        report.noOpMessageCount +=
          targets.userContributionCounts.get(userId) ?? 0;
      }
      if (progress) Object.assign(progress, report);
      writeCalendarExportRebuildAnalytics({ status: "ok" });
    } catch (error) {
      if (progress) Object.assign(progress, report);
      writeCalendarExportRebuildAnalytics({ status: "error" });
      throw error;
    }
  }
}

export type CalendarExportRebuildQueueMessage = {
  ack(): void;
  attempts?: number;
  body: unknown;
  retry(): void;
  timestamp?: Date;
};

export type CalendarExportRebuildQueueBatch = {
  messages: readonly CalendarExportRebuildQueueMessage[];
};

export type CalendarExportRebuildQueueBatchReport = {
  outcome: CalendarQueueBatchOutcome;
};

type CalendarExportRebuildBatchCounters = {
  ackedMessageCount: number;
  inputMessageCount: number;
  invalidMessageCount: number;
  maxAgeMs: number;
  maxAttempts: number;
  noOpMessageCount: number;
  noSubscriberMessageCount: number;
  processedUserCount: number;
  retriedMessageCount: number;
  sectionMessageCount: number;
  uniqueUserRebuildCount: number;
  userMessageCount: number;
};

function recordQueueMessageMetadata(
  counters: CalendarExportRebuildBatchCounters,
  message: CalendarExportRebuildQueueMessage,
  now: number,
) {
  if (message.timestamp instanceof Date) {
    const ageMs = now - message.timestamp.getTime();
    if (Number.isFinite(ageMs)) {
      counters.maxAgeMs = Math.max(counters.maxAgeMs, Math.max(0, ageMs));
    }
  }
  if (
    typeof message.attempts === "number" &&
    Number.isFinite(message.attempts)
  ) {
    counters.maxAttempts = Math.max(
      counters.maxAttempts,
      Math.max(0, message.attempts),
    );
  }
}

/**
 * Worker queue entrypoint: parse, coalesce, rebuild, ack/retry per message.
 */
export async function handleCalendarExportRebuildBatch(
  batch: CalendarExportRebuildQueueBatch,
): Promise<CalendarExportRebuildQueueBatchReport> {
  const start = monotonicNowMs();
  const counters: CalendarExportRebuildBatchCounters = {
    ackedMessageCount: 0,
    inputMessageCount: batch.messages.length,
    invalidMessageCount: 0,
    maxAgeMs: 0,
    maxAttempts: 0,
    noOpMessageCount: 0,
    noSubscriberMessageCount: 0,
    processedUserCount: 0,
    retriedMessageCount: 0,
    sectionMessageCount: 0,
    uniqueUserRebuildCount: 0,
    userMessageCount: 0,
  };
  const processingProgress: CalendarExportRebuildProcessingReport = {
    noOpMessageCount: 0,
    noSubscriberMessageCount: 0,
    processedUserCount: 0,
    uniqueUserRebuildCount: 0,
  };
  let outcome: CalendarQueueBatchOutcome = "error";
  try {
    const now = Date.now();
    const parsed: CalendarExportRebuildMessage[] = [];
    const validMessages: CalendarExportRebuildQueueMessage[] = [];

    for (const message of batch.messages) {
      recordQueueMessageMetadata(counters, message, now);
      const body = parseCalendarExportRebuildMessage(message.body);
      if (!body) {
        counters.invalidMessageCount += 1;
        logAppEvent("error", "calendar-export-rebuild.invalid-message", {
          event: "calendar-export-rebuild.invalid-message",
          phase: "consumer",
          reason: "invalid_envelope",
          source: "calendar-export-rebuild",
        });
        // Keep the body out of logs. Retrying lets the configured DLQ retain the
        // invalid envelope for bounded operational inspection.
        counters.retriedMessageCount += 1;
        message.retry();
        continue;
      }
      parsed.push(body);
      validMessages.push(message);
      if (body.type === "user") {
        counters.userMessageCount += 1;
      } else {
        counters.sectionMessageCount += 1;
      }
    }

    if (batch.messages.length === 0) {
      outcome = "success";
      return { outcome };
    }
    if (parsed.length === 0) {
      outcome = "retry";
      return { outcome };
    }

    try {
      await processCalendarExportRebuildMessages(parsed, processingProgress);
      for (const message of validMessages) {
        message.ack();
        counters.ackedMessageCount += 1;
      }
      outcome =
        validMessages.length < batch.messages.length ? "partial" : "success";
      return { outcome };
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
        counters.retriedMessageCount += 1;
        message.retry();
      }
      outcome = "retry";
      return { outcome };
    }
  } finally {
    Object.assign(counters, processingProgress);
    writeCalendarQueueBatchAnalytics({
      ...counters,
      durationMs: elapsedMs(start),
      outcome,
    });
  }
}
