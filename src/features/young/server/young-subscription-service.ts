import { scheduleInvalidateUserCalendarExportCache } from "@/features/calendar/server/calendar-export-invalidation";
import type { Prisma } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginationInput,
} from "@/lib/pagination";
import { toYoungEventSummary, YOUNG_EVENT_SELECT } from "./young-event-service";
import { youngEventState } from "./young-notification-state";

export class YoungSubscriptionNotFoundError extends Error {}

export async function lockYoungSubscriptionUser(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}

export type YoungReminderSettings = {
  remindSignup?: boolean;
  remindDeadline?: boolean;
  remindStart?: boolean;
};

export async function setYoungEventSubscription(
  userId: string,
  youngId: string,
  subscribed: boolean,
  settings: YoungReminderSettings = {},
) {
  const result = await withUserDbContext(userId, async (tx) => {
    await lockYoungSubscriptionUser(tx, userId);
    const event = await tx.youngEvent.findUnique({ where: { youngId } });
    if (!event) throw new YoungSubscriptionNotFoundError("Unknown Young event");
    if (!subscribed) {
      await tx.userYoungEventSubscription.deleteMany({
        where: { userId, youngId },
      });
      await tx.youngNotification.deleteMany({
        where: { userId, youngId, readAt: null },
      });
      return {
        youngId,
        subscribed: false,
        remindSignup: false,
        remindDeadline: false,
        remindStart: false,
      };
    }
    const row = await tx.userYoungEventSubscription.upsert({
      where: { userId_youngId: { userId, youngId } },
      create: {
        userId,
        youngId,
        observedState: youngEventState(event),
        ...settings,
      },
      update: settings,
    });
    const disabled = [
      ...(!row.remindSignup ? ["signup_open"] : []),
      ...(!row.remindDeadline ? ["signup_deadline"] : []),
      ...(!row.remindStart ? ["event_start"] : []),
    ];
    if (disabled.length)
      await tx.youngNotification.deleteMany({
        where: { userId, youngId, readAt: null, kind: { in: disabled } },
      });
    return {
      youngId,
      subscribed: true,
      remindSignup: row.remindSignup,
      remindDeadline: row.remindDeadline,
      remindStart: row.remindStart,
    };
  });
  scheduleInvalidateUserCalendarExportCache(userId);
  return result;
}

export async function listYoungEventSubscriptions(
  userId: string,
  input: PaginationInput = {},
) {
  const { page, pageSize, skip } = normalizePagination(input);
  return withUserDbContext(userId, async (tx) => {
    const where = { userId };
    const [total, rows] = await Promise.all([
      tx.userYoungEventSubscription.count({ where }),
      tx.userYoungEventSubscription.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ createdAt: "desc" }, { youngId: "asc" }],
        include: { event: { select: YOUNG_EVENT_SELECT } },
      }),
    ]);
    return buildPaginatedResponse(
      rows.map((row) => ({
        youngId: row.youngId,
        createdAt: row.createdAt,
        remindSignup: row.remindSignup,
        remindDeadline: row.remindDeadline,
        remindStart: row.remindStart,
        event: toYoungEventSummary(row.event),
      })),
      page,
      pageSize,
      total,
    );
  });
}

export async function getYoungEventSubscription(
  userId: string,
  youngId: string,
) {
  return withUserDbContext(userId, async (tx) => {
    const row = await tx.userYoungEventSubscription.findUnique({
      where: { userId_youngId: { userId, youngId } },
    });
    return {
      youngId,
      subscribed: row != null,
      remindSignup: row?.remindSignup ?? true,
      remindDeadline: row?.remindDeadline ?? true,
      remindStart: row?.remindStart ?? true,
    };
  });
}

export async function setYoungOrganizerSubscription(
  userId: string,
  organizerId: string,
  subscribed: boolean,
) {
  return withUserDbContext(userId, async (tx) => {
    await lockYoungSubscriptionUser(tx, userId);
    const organizer = await tx.youngOrganizer.findUnique({
      where: { id: organizerId },
      select: { id: true },
    });
    if (!organizer)
      throw new YoungSubscriptionNotFoundError("Unknown Young organizer");
    if (subscribed) {
      await tx.userYoungOrganizerSubscription.upsert({
        where: { userId_organizerId: { userId, organizerId } },
        create: { userId, organizerId },
        update: {},
      });
    } else {
      await tx.userYoungOrganizerSubscription.deleteMany({
        where: { userId, organizerId },
      });
      await tx.youngNotification.deleteMany({
        where: { userId, organizerId, readAt: null },
      });
    }
    return { organizerId, subscribed };
  });
}

export async function listYoungOrganizerSubscriptions(
  userId: string,
  input: PaginationInput = {},
) {
  const { page, pageSize, skip } = normalizePagination(input);
  return withUserDbContext(userId, async (tx) => {
    const where = { userId };
    const [total, rows] = await Promise.all([
      tx.userYoungOrganizerSubscription.count({ where }),
      tx.userYoungOrganizerSubscription.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ createdAt: "desc" }, { organizerId: "asc" }],
        select: {
          organizerId: true,
          createdAt: true,
          organizer: { select: { id: true, name: true } },
        },
      }),
    ]);
    return buildPaginatedResponse(rows, page, pageSize, total);
  });
}

export async function getYoungOrganizerSubscription(
  userId: string,
  organizerId: string,
) {
  const row = await withUserDbContext(userId, (tx) =>
    tx.userYoungOrganizerSubscription.findUnique({
      where: { userId_organizerId: { userId, organizerId } },
      select: { organizerId: true },
    }),
  );
  return { organizerId, subscribed: row != null };
}
