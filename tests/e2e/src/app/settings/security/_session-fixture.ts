import { expect, type Page } from "@playwright/test";
import type { Session } from "@/generated/prisma-node/client";
import { withBrowserWorkflow } from "../../../../utils/browser-workflow";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test as settingsTest } from "../../../../utils/settings-fixture";

type SessionState = {
  current: Session;
  other: Session;
  another: Session;
  foreign: Session;
};

export const test = settingsTest.extend<{
  sessions: SessionState;
  sessionRun: (work: () => Promise<void>) => Promise<void>;
}>({
  sessions: async ({ account, isolatedWorker, run }, use) => {
    const sessions = await run(async () => {
      const db = isolatedWorker.database.owner;
      const current = await db.session.findFirstOrThrow({
        where: { userId: account.id },
      });
      await db.session.update({
        where: { id: current.id },
        data: {
          createdAt: new Date(Date.now() - 60 * 1000),
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
        },
      });
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      const other = await db.session.create({
        data: {
          userId: account.id,
          sessionToken: crypto.randomUUID(),
          expires,
          userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36",
        },
      });
      const another = await db.session.create({
        data: {
          userId: account.id,
          sessionToken: crypto.randomUUID(),
          expires,
          userAgent: "Mozilla/5.0 (Android 14) Chrome/130.0 Safari/537.36",
        },
      });
      const foreignActor = await isolatedWorker.createActor();
      const foreign = await db.session.findFirstOrThrow({
        where: { userId: foreignActor.id },
      });
      return { current, other, another, foreign };
    });
    await use(sessions);
  },
  sessionRun: async ({ page, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) => workflow.run(() => run(work)));
    });
  },
});

export async function openSessions(page: Page) {
  await gotoAndWaitForReady(page, "/account/settings/security");
  const panel = page.locator("[data-session-settings]");
  await expect(
    panel.getByRole("button", { name: /撤销其他会话|Revoke other sessions/ }),
  ).toBeEnabled();
  return panel;
}

export async function confirmRevocation(page: Page) {
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /确认撤销|Confirm revocation/ })
    .click();
}
