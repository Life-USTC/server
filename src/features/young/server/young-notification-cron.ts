import type { PrismaClient } from "@/generated/prisma/client";
import { RUNTIME_DATABASE_POOL_CAPACITY } from "@/lib/db/runtime-pool-capacity";
import { refreshYoungNotifications } from "./young-notification-service";

/** The maintenance client only discovers recipients; all user writes use RLS. */
export async function runYoungNotificationCron(
  client: PrismaClient,
  now = new Date(),
) {
  let after: string | undefined;
  let processed = 0;
  while (true) {
    const users = await client.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.list_young_notification_recipients(${after ?? null}, 100)
    `;
    if (!users.length) break;
    for (
      let offset = 0;
      offset < users.length;
      offset += RUNTIME_DATABASE_POOL_CAPACITY
    ) {
      // Every owner starts a transaction on the same request-scoped app pool.
      // Drain admitted owners before propagating failure or releasing runtime IO.
      const results = await Promise.allSettled(
        users
          .slice(offset, offset + RUNTIME_DATABASE_POOL_CAPACITY)
          .map((user) => refreshYoungNotifications(user.id, now)),
      );
      for (const result of results) {
        if (result.status === "rejected") throw result.reason;
      }
    }
    processed += users.length;
    after = users[users.length - 1].id;
  }
  return { processed };
}
