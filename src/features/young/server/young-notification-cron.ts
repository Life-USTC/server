import type { PrismaClient } from "@/generated/prisma/client";
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
    for (let offset = 0; offset < users.length; offset += 5) {
      await Promise.all(
        users
          .slice(offset, offset + 5)
          .map((user) => refreshYoungNotifications(user.id, now)),
      );
    }
    processed += users.length;
    after = users[users.length - 1].id;
  }
  return { processed };
}
