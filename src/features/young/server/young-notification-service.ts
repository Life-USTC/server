import { scheduleInvalidateUserCalendarExportCache } from "@/features/calendar/server/calendar-export-invalidation";
import type { Prisma } from "@/generated/prisma/client";
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
    const notifications: Prisma.YoungNotificationCreateManyInput[] = [];
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
        notifications.push({
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
              (candidate.at?.getTime() ?? now.getTime()) + 24 * 60 * 60 * 1000,
            ),
        });
      }
    }
    const dayEnd = startOfShanghaiDay(now);
    const dayStart = addShanghaiTime(dayEnd, -1, "day");
    const digests = await tx.$queryRaw<
      { organizerId: string; title: string; total: bigint; names: string[] }[]
    >`
      WITH ranked AS (
        SELECT f."organizerId", e.name,
               row_number() OVER (
                 PARTITION BY f."organizerId" ORDER BY e."startAt", e."youngId"
               ) AS position
        FROM "UserYoungOrganizerSubscription" f
        JOIN "YoungEvent" e ON e."organizerId" = f."organizerId"
        WHERE f."userId" = ${userId}
          AND e."createdAt" >= ${dayStart} AND e."createdAt" < ${dayEnd}
          AND e."createdAt" > f."createdAt"
          AND NOT e."sourceMissing" AND e."startAt" >= ${now}
      )
      SELECT r."organizerId", o.name AS title, count(*) AS total,
             array_agg(r.name ORDER BY r.position) FILTER (WHERE r.position <= 10) AS names
      FROM ranked r
      JOIN "YoungOrganizer" o ON o.id = r."organizerId"
      GROUP BY r."organizerId", o.name
    `;
    for (const { organizerId, title, total, names } of digests) {
      notifications.push({
        userId,
        organizerId,
        kind: "organizer_digest",
        title,
        body: `${total} 个新活动 / new events: ${names.join(" · ")}${total > names.length ? " …" : ""}`,
        dedupeKey: `organizer:${organizerId}:${dayStart.toISOString()}`,
        createdAt: now,
      });
    }
    if (notifications.length)
      await tx.youngNotification.createMany({
        data: notifications,
        skipDuplicates: true,
      });
    return calendarChanged;
  });
  if (changed) scheduleInvalidateUserCalendarExportCache(userId);
}

export async function countUnreadYoungNotifications(
  userId: string,
  now = new Date(),
) {
  return withUserDbContext(userId, (tx) =>
    tx.youngNotification.count({
      where: {
        userId,
        readAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
  );
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
