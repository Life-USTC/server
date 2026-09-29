import { expect, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { withBrowserWorkflow } from "./browser-workflow";
import { withHomeworkEffects } from "./homework-effects";
import type { IsolatedWorker } from "./isolated-worker";
import { createMobilePageState, type MobileRole } from "./mobile-page-state";
import { test as workerTest } from "./owned-worker";
import { gotoAndWaitForReady } from "./page-ready";

type MobileAccount = Awaited<ReturnType<typeof createMobilePageState>>;

export const test = workerTest.extend<{
  mobileRole: MobileRole;
  incompleteMobileProfile: boolean;
  mobileAccount: MobileAccount;
  mobileSession: Awaited<ReturnType<IsolatedWorker["createSession"]>>;
  mobileRun: (
    work: Parameters<typeof withHomeworkEffects>[1],
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
    testInfo,
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
                testInfo,
                calendarMessages: [],
                calendarTokenCreated,
                observeReads: true,
              },
              (effects) =>
                workflow.body(async () => {
                  await page.context().addCookies([mobileSession.cookie]);
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
                        : "/workspace/overview";
                    await gotoAndWaitForReady(page, landing);
                    await expect(page).toHaveURL(
                      new URL(landing, isolatedWorker.origin).href,
                    );
                    await expect(page.locator("#main-content")).toBeVisible();
                  }
                  await work(effects);
                }),
            ),
          ),
        ),
      );
    });
  },
});

/** Preserve the public helper's route-health assertions while the caller
 * registers each test through its private Worker fixture. */
export async function expectHealthyMobileRoute(page: Page, path: string) {
  const response = await gotoAndWaitForReady(page, path, {
    browserHealth: {},
    expectMeaningfulContent: true,
    expectNoHorizontalOverflow: true,
    uiQuality: {},
  });
  expect(
    response,
    `Expected ${path} to return a document response`,
  ).not.toBeNull();
  expect(response?.ok(), `Expected ${path} to return a successful status`).toBe(
    true,
  );
  expect(
    (await page.title()).trim(),
    `Expected ${path} to have a page title`,
  ).not.toBe("");
}
