import { expect } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { withBrowserWorkflow } from "./browser-workflow";
import { DEV_SEED_ANCHOR } from "./dev-seed";
import {
  type HomeworkEffectContext,
  withHomeworkEffects,
} from "./homework-effects";
import type { IsolatedWorker } from "./isolated-worker";
import { createMobilePageState, type MobileRole } from "./mobile-page-state";
import { test as workerTest } from "./owned-worker";
import { gotoAndWaitForReady } from "./page-ready";

type MobileAccount = Awaited<ReturnType<typeof createMobilePageState>>;
type MobileContext = HomeworkEffectContext & { startPage: () => Promise<void> };

export const test = workerTest.extend<{
  mobileRole: MobileRole;
  incompleteMobileProfile: boolean;
  mobileAccount: MobileAccount;
  mobileSession: Awaited<ReturnType<IsolatedWorker["createSession"]>>;
  mobileRun: (
    work: (context: MobileContext) => Promise<void>,
    effects: { calendarTokenCreated: boolean },
  ) => Promise<void>;
}>({
  mobileRole: ["user", { option: true }],
  incompleteMobileProfile: [false, { option: true }],
  mobileAccount: async (
    { isolatedWorker, run, mobileRole, incompleteMobileProfile },
    use,
  ) => {
    await use(
      await run(async () => {
        const password = await hashPassword("mobile-test-password");
        return isolatedWorker.database.owner.$transaction((db) =>
          createMobilePageState(
            db,
            mobileRole,
            incompleteMobileProfile,
            isolatedWorker.origin,
            password,
          ),
        );
      }),
    );
  },
  mobileSession: async ({ isolatedWorker, mobileAccount, run }, use) => {
    await use(await run(() => isolatedWorker.createSession(mobileAccount.id)));
  },
  mobileRun: async (
    {
      page,
      mobileAccount,
      mobileSession,
      mobileRole,
      incompleteMobileProfile,
      isolatedWorker,
      run,
    },
    use,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work, { calendarTokenCreated }) =>
        workflow.run(() =>
          run(() =>
            withHomeworkEffects(
              {
                page,
                isolatedWorker,
                account: mobileAccount,
                runBody: workflow.body,
                calendarMessages: [],
                calendarTokenCreated,
                observeReads: true,
              },
              async (effects) => {
                await page.context().addCookies([mobileSession.cookie]);
                const startPage = async () => {
                  const response = await page.request.get(
                    "/api/auth/get-session",
                    { headers: effects.headers },
                  );
                  expect(response.status()).toBe(200);
                  expect((await response.json()).user).toMatchObject({
                    id: mobileAccount.id,
                    isAdmin: mobileRole === "admin",
                  });
                  // Preserve the signed-in landing before route navigation.
                  if (!incompleteMobileProfile) {
                    const landing =
                      mobileRole === "admin"
                        ? "/admin/users"
                        : `/workspace/overview?snapshotAt=${encodeURIComponent(DEV_SEED_ANCHOR.recommendedAtTime)}`;
                    await gotoAndWaitForReady(page, landing);
                    await expect(page).toHaveURL(
                      new URL(landing, isolatedWorker.origin).href,
                    );
                    await expect(page.locator("#main-content")).toBeVisible();
                  }
                };
                await work({ ...effects, startPage });
              },
            ),
          ),
        ),
      );
    });
  },
});
