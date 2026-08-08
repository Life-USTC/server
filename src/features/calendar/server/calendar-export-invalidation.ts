import { invalidateUserCalendarExportCache } from "@/features/calendar/server/calendar-export-cache";
import {
  scheduleSectionCalendarExportRebuild,
  scheduleUserCalendarExportRebuild,
} from "@/features/calendar/server/calendar-export-queue";
import { prisma } from "@/lib/db/prisma";

export { invalidateUserCalendarExportCache };

/**
 * After a user-scoped write, enqueue an ICS rebuild (overwrite KV) instead of
 * waitUntil delete/fan-out.
 */
export function scheduleInvalidateUserCalendarExportCache(userId: string) {
  scheduleUserCalendarExportRebuild(userId);
}

/**
 * Sync helper for tests/local: delete cached exports for every subscriber.
 */
export async function invalidateCalendarExportsForSection(sectionId: number) {
  const subscribers = await prisma.userSectionSubscription.findMany({
    where: { sectionId },
    select: { userId: true },
  });
  await Promise.all(
    subscribers.map((subscriber) =>
      invalidateUserCalendarExportCache(subscriber.userId),
    ),
  );
}

/**
 * After a section-scoped write, enqueue one section rebuild message. The queue
 * consumer expands subscribers and rebuilds (no N deletes in waitUntil).
 */
export function scheduleInvalidateCalendarExportsForSection(sectionId: number) {
  scheduleSectionCalendarExportRebuild(sectionId);
}
