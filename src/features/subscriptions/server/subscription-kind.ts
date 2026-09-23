import { scheduleInvalidateUserCalendarExportCache } from "@/features/calendar/server/calendar-export-invalidation";
import { withUserDbContext } from "@/lib/db/prisma";
import {
  type SubscriptionKind,
  subscriptionKindSchema,
} from "../lib/subscription-kind";

export async function getUserSubscriptionKinds(userId: string) {
  const rows = await withUserDbContext(userId, (tx) =>
    tx.userSectionSubscription.findMany({
      where: { userId },
      select: { sectionId: true, kind: true },
    }),
  );
  return new Map(rows.map((row) => [row.sectionId, row.kind]));
}

export async function updateSubscriptionKind(input: {
  userId: string;
  sectionJwId: number;
  kind: SubscriptionKind;
}) {
  const kind = subscriptionKindSchema.parse(input.kind);
  const updated = await withUserDbContext(input.userId, (tx) =>
    tx.userSectionSubscription.updateMany({
      where: { userId: input.userId, section: { jwId: input.sectionJwId } },
      data: { kind },
    }),
  );
  if (updated.count === 0) return null;
  scheduleInvalidateUserCalendarExportCache(input.userId);
  return { sectionJwId: input.sectionJwId, kind };
}
