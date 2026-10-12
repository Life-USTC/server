import { type CDPSession, expect } from "@playwright/test";
import type { AuditAction, User } from "@/generated/prisma-node/client";
import { adminWriteChecks } from "../../../utils/admin-fixture";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { withCalendarProtocol } from "../../../utils/calendar-protocol-lifecycle";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { test as workerTest } from "../../../utils/owned-worker";
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
  passkeyAudit: (work: () => Promise<void>) => Promise<void>;
  accountAuditRun: (
    plan: {
      browser: Parameters<typeof adminWriteChecks>[0];
      native: Parameters<typeof adminWriteChecks>[0];
      audits: readonly (readonly [
        AuditAction,
        "success" | "denied" | "failure",
      ])[];
    },
    work: () => Promise<void>,
  ) => Promise<void>;
}>({
  accountAudit: async ({ page, isolatedWorker, run }, use, testInfo) => {
    const fixture = await run(async () => {
      const db = isolatedWorker.database.owner;
      const actor = await isolatedWorker.createActor();
      const user = await db.user.update({
        where: { id: actor.id },
        data: { name: "Private audit user" },
      });
      await page.context().addCookies([actor.cookie]);
      return {
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
        events: (action: AuditAction) =>
          db.auditLog.findMany({
            where: { userId: user.id, action },
            orderBy: { createdAt: "asc" },
          }),
      };
    });
    await use(fixture);
  },
  accountAuditRun: async (
    { page, request: observer, playwright, isolatedWorker, run },
    use,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((plan, work) =>
        workflow.run(() =>
          run(() => {
            const checks = adminWriteChecks(plan.browser, plan.native);
            return withCalendarProtocol(
              {
                page,
                observer,
                isolatedWorker,
                runBody: workflow.body,
                createRequest: (headers) =>
                  playwright.request.newContext({
                    baseURL: isolatedWorker.origin,
                    extraHTTPHeaders: headers,
                  }),
                verifyBrowserWrite: checks.verifyBrowserWrite,
              },
              async () => {
                await work();
                return {
                  verifyTransport: ({ effects, sdkRequests }) =>
                    checks.verifyTransport({ producer: effects, sdkRequests }),
                  async verifyState() {
                    const db = isolatedWorker.database.owner;
                    await expect
                      .poll(() => db.auditLog.count())
                      .toBe(plan.audits.length);
                    expect(
                      (
                        await db.auditLog.findMany({
                          select: { action: true, outcome: true },
                        })
                      )
                        .map(({ action, outcome }) => [action, outcome])
                        .sort(),
                    ).toEqual([...plan.audits].sort());
                    expect(await db.oAuthGrantUsageDaily.count()).toBe(0);
                  },
                };
              },
            );
          }),
        ),
      );
    });
  },
  passkeyAudit: async ({ accountAudit, page }, use) => {
    // Registration and the CDP resource share the active browser callback.
    await use(async (work) => {
      let cdp: CDPSession | undefined;
      let authenticatorId: string | undefined;
      try {
        cdp = await page.context().newCDPSession(page);
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
        expect(count).toBe(1);
        await expect
          .poll(
            async () =>
              (await accountAudit.events("account_passkey_create")).length,
          )
          .toBe(count);
        await work();
      } finally {
        if (cdp) {
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
      }
    });
  },
});
