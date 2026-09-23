import { scheduleInvalidateUserCalendarExportCache } from "@/features/calendar/server/calendar-export-invalidation";
import { withUserDbContext } from "@/lib/db/prisma";
import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginationInput,
} from "@/lib/pagination";
import {
  addShanghaiTime,
  startOfShanghaiDay,
} from "@/lib/time/shanghai-format";
import {
  youngEventState,
  youngReminderCandidates,
} from "./young-notification-state";
import { lockYoungSubscriptionUser } from "./young-subscription-service";

export async function refreshYoungNotifications(
  userId: string,
  now = new Date(),
) {
  const changed = await withUserDbContext(userId, async (tx) => {
    await lockYoungSubscriptionUser(tx, userId);
    const subscriptions = await tx.userYoungEventSubscription.findMany({
      where: { userId },
      include: { event: true },
    });
    let calendarChanged = false;
    for (const subscription of subscriptions) {
      const event = subscription.event;
      const state = youngEventState(event);
      const candidates = youngReminderCandidates(event, subscription, now);
      const reminderKey = (kind: string, at: Date | null) =>
        `${subscription.id}:${kind}:${at?.toISOString()}`;
      if (state !== subscription.observedState) {
        calendarChanged = true;
        await tx.youngNotification.deleteMany({
          where: {
            userId,
            youngId: event.youngId,
            readAt: null,
            kind: { in: ["signup_open", "signup_deadline", "event_start"] },
            dedupeKey: {
              notIn: candidates.map((item) => reminderKey(item.kind, item.at)),
            },
          },
        });
        const updated = await tx.userYoungEventSubscription.update({
          where: { userId_youngId: { userId, youngId: event.youngId } },
          data: { observedState: state, observedRevision: { increment: 1 } },
        });
        await tx.youngNotification.create({
          data: {
            userId,
            youngId: event.youngId,
            kind: "event_changed",
            title: event.name,
            body: event.sourceMissing
              ? "来源暂缺，请核实校方信息 / Source unavailable; check the official event page."
              : "活动信息有更新，请查看最新时间、地点和报名状态 / Event details changed; check the latest time, venue and registration status.",
            dedupeKey: `${subscription.id}:change:${updated.observedRevision}`,
            createdAt: now,
          },
        });
      }
      for (const candidate of candidates) {
        const dedupeKey = reminderKey(candidate.kind, candidate.at);
        await tx.youngNotification.upsert({
          where: { userId_dedupeKey: { userId, dedupeKey } },
          update: {},
          create: {
            userId,
            youngId: event.youngId,
            kind: candidate.kind,
            title: event.name,
            body: candidate.label,
            dedupeKey,
            createdAt: now,
            expiresAt:
              candidate.end ??
              new Date(
                (candidate.at?.getTime() ?? now.getTime()) +
                  24 * 60 * 60 * 1000,
              ),
          },
        });
      }
    }
    const follows = await tx.userYoungOrganizerSubscription.findMany({
      where: { userId },
      include: { organizer: true },
    });
    const dayEnd = startOfShanghaiDay(now);
    const dayStart = addShanghaiTime(dayEnd, -1, "day");
    for (const follow of follows) {
      // A completed-day digest never sends a partial day's results twice.
      if (follow.createdAt >= dayEnd) continue;
      const where = {
        organizerId: follow.organizerId,
        sourceMissing: false,
        createdAt: {
          gt: follow.createdAt > dayStart ? follow.createdAt : dayStart,
          lt: dayEnd,
        },
        startAt: { gte: now },
      };
      const total = await tx.youngEvent.count({ where });
      if (!total) continue;
      const events = await tx.youngEvent.findMany({
        where,
        select: { name: true },
        orderBy: [{ startAt: "asc" }, { youngId: "asc" }],
        take: 10,
      });
      const dedupeKey = `organizer:${follow.organizerId}:${dayStart.toISOString()}`;
      await tx.youngNotification.upsert({
        where: { userId_dedupeKey: { userId, dedupeKey } },
        update: {},
        create: {
          userId,
          organizerId: follow.organizerId,
          kind: "organizer_digest",
          title: follow.organizer.name,
          body: `${total} 个新活动 / new events: ${events.map((event) => event.name).join(" · ")}${total > events.length ? " …" : ""}`,
          dedupeKey,
          createdAt: now,
        },
      });
    }
    return calendarChanged;
  });
  if (changed) scheduleInvalidateUserCalendarExportCache(userId);
}

export async function listYoungNotifications(
  userId: string,
  input: PaginationInput & { unread?: boolean } = {},
  now = new Date(),
) {
  await refreshYoungNotifications(userId, now);
  const { page, pageSize, skip } = normalizePagination(input);
  return withUserDbContext(userId, async (tx) => {
    const where = {
      userId,
      ...(input.unread ? { readAt: null } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
    const [total, rows] = await Promise.all([
      tx.youngNotification.count({ where }),
      tx.youngNotification.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          youngId: true,
          organizerId: true,
          kind: true,
          title: true,
          body: true,
          createdAt: true,
          readAt: true,
          expiresAt: true,
        },
      }),
    ]);
    return buildPaginatedResponse(rows, page, pageSize, total);
  });
}

export async function readYoungNotification(userId: string, id: string) {
  return withUserDbContext(userId, async (tx) => {
    const row = await tx.youngNotification.findFirst({
      where: { id, userId },
      select: { readAt: true },
    });
    if (!row) return { id, success: false };
    await tx.youngNotification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { id, success: true };
  });
}
