import { type CDPSession, expect } from "@playwright/test";
import type { AuditAction, User } from "@/generated/prisma-node/client";
import {
  type IsolatedWorker,
  test as workerTest,
} from "../../../utils/isolated-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

type Database = IsolatedWorker["database"]["owner"];
export type AccountAudit = {
  db: Database;
  user: User;
  cookie: { value: string };
  origin: string;
  logPath: string;
  token: () => Promise<{ calendarFeedToken: string | null }>;
  events: (action: AuditAction) => ReturnType<Database["auditLog"]["findMany"]>;
};

export const test = workerTest.extend<{
  accountAudit: AccountAudit;
  virtualAuthenticator: { cdp: CDPSession; authenticatorId: string };
  passkeyAudit: AccountAudit;
}>({
  accountAudit: async ({ page, isolatedWorker }, use, testInfo) => {
    const db = isolatedWorker.database.owner;
    const actor = await isolatedWorker.createActor();
    const user = await db.user.update({
      where: { id: actor.id },
      data: { name: "Private audit user" },
    });
    await page.context().addCookies([actor.cookie]);
    await use({
      db,
      user,
      cookie: actor.cookie,
      origin: isolatedWorker.origin,
      logPath: testInfo.outputPath("isolated-worker.log"),
      token: () =>
        db.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { calendarFeedToken: true },
        }),
      events: (action) =>
        db.auditLog.findMany({
          where: { userId: user.id, action },
          orderBy: { createdAt: "asc" },
        }),
    });
  },
  virtualAuthenticator: async ({ page }, use) => {
    const cdp = await page.context().newCDPSession(page);
    let authenticatorId: string | undefined;
    try {
      await cdp.send("WebAuthn.enable");
      ({ authenticatorId } = await cdp.send(
        "WebAuthn.addVirtualAuthenticator",
        {
          options: {
            protocol: "ctap2",
            ctap2Version: "ctap2_1",
            transport: "internal",
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true,
            automaticPresenceSimulation: true,
          },
        },
      ));
      await use({ cdp, authenticatorId });
    } finally {
      try {
        if (authenticatorId)
          await cdp.send("WebAuthn.removeVirtualAuthenticator", {
            authenticatorId,
          });
        await cdp.send("WebAuthn.disable");
      } finally {
        await cdp.detach();
      }
    }
  },
  passkeyAudit: async (
    { accountAudit, virtualAuthenticator: _authenticator, page },
    use,
  ) => {
    await gotoAndWaitForReady(page, "/account/settings/accounts");
    const name = "Private registration name";
    const card = page.locator("[data-passkey-settings]");
    await card.getByLabel(/通行密钥名称|Passkey name/i).fill(name);
    await card
      .getByRole("button", { name: /添加通行密钥|Add passkey/i })
      .click();
    await expect(
      card.getByLabel(new RegExp(`重命名 ${name}|Rename ${name}`, "i")),
    ).toHaveValue(name);
    const count = await accountAudit.db.passkey.count({
      where: { userId: accountAudit.user.id },
    });
    await expect
      .poll(
        async () =>
          (await accountAudit.events("account_passkey_create")).length,
      )
      .toBe(count);
    await use(accountAudit);
  },
});
