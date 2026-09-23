import { withUserDbContext } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { toYoungEventSummary, YOUNG_EVENT_SELECT } from "./young-event-service";

export async function listSubscribedYoungCalendarEvents(
  userId: string,
  from: Date,
  to: Date,
  inclusive: boolean,
) {
  const rows = await withUserDbContext(userId, (tx) =>
    tx.userYoungEventSubscription.findMany({
      where: {
        userId,
        event: {
          startAt: inclusive ? { lte: to } : { lt: to },
          OR: [
            { endAt: { gt: from } },
            { endAt: null, startAt: { gte: from } },
          ],
        },
      },
      select: { event: { select: YOUNG_EVENT_SELECT } },
    }),
  );
  return rows.map(({ event }) => ({
    type: "young_event" as const,
    at: event.startAt ? toShanghaiIsoString(event.startAt) : null,
    filterStart: event.startAt,
    filterEnd: event.endAt,
    sortKey: event.startAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
    payload: toYoungEventSummary(event),
  }));
}
