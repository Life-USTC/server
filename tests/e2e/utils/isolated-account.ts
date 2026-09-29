import { test as base } from "@playwright/test";
import type { User } from "../../../src/generated/prisma-node/client";
import { withE2ePrisma } from "./e2e-db/prisma";
import { createSignedSessionCookie } from "./signed-session-cookie";

/** Only tests requesting account receive a fresh signed-in identity. */
export const test = base.extend<{ account: User }>({
  account: async ({ page }, use) => {
    const marker = crypto.randomUUID().replaceAll("-", "");
    const account = await withE2ePrisma((db) =>
      db.user.create({
        data: {
          name: `E2E account ${marker.slice(0, 8)}`,
          username: `e2e${marker.slice(0, 17)}`,
          email: `e2e-account-${marker}@example.test`,
          emailVerified: true,
        },
      }),
    );
    const sessionIds: string[] = [];
    try {
      await page
        .context()
        .addCookies([await createSignedSessionCookie(account.id)]);
      sessionIds.push(
        ...(await withE2ePrisma(async (db) =>
          (
            await db.session.findMany({
              where: { userId: account.id },
              select: { id: true },
            })
          ).map((session) => session.id),
        )),
      );
      await use(account);
    } finally {
      try {
        await page.close();
      } finally {
        await withE2ePrisma((db) =>
          db.$transaction([
            db.auditLog.deleteMany({
              where: {
                OR: [
                  { userId: account.id },
                  { subjectUserId: account.id },
                  { sessionId: { in: sessionIds } },
                ],
              },
            }),
            db.featureOperationEvent.deleteMany({
              where: { userId: account.id },
            }),
            db.user.deleteMany({ where: { id: account.id } }),
          ]),
        );
      }
    }
  },
});
