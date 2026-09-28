import { test as base } from "@playwright/test";
import type { User } from "../../../src/generated/prisma-node/client";
import { withE2ePrisma } from "./e2e-db/prisma";
import { createSignedSessionCookie } from "./workspace-task-filters";

/** Only tests requesting account receive a fresh signed-in identity. */
export const test = base.extend<{ account: User }>({
  account: async ({ page }, use) => {
    const marker = crypto.randomUUID().replaceAll("-", "");
    const account = await withE2ePrisma((db) =>
      db.user.create({
        data: {
          name: `E2E account ${marker.slice(0, 8)}`,
          username: `e2e${marker.slice(0, 20)}`,
          email: `e2e-account-${marker}@example.test`,
          emailVerified: true,
        },
      }),
    );
    try {
      await page
        .context()
        .addCookies([await createSignedSessionCookie(account.id)]);
      await use(account);
    } finally {
      try {
        await page.close();
      } finally {
        await withE2ePrisma((db) =>
          db.$transaction([
            db.auditLog.deleteMany({
              where: {
                OR: [{ userId: account.id }, { subjectUserId: account.id }],
              },
            }),
            db.featureOperationEvent.deleteMany({
              where: { userId: account.id },
            }),
            db.user.delete({ where: { id: account.id } }),
          ]),
        );
      }
    }
  },
});
