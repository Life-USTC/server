/**
 * E2E tests for workspace route variants (`/workspace/<tab>`).
 */
import { expect, type Page, test } from "@playwright/test";
import type { Session } from "../../../../../../src/generated/prisma-node/client";
import { expectRequiresSignIn } from "../../../../utils/auth";
import {
  expectPrivateViewerState,
  expectReadOnlyWorkspace,
  preparePrivateViewer,
  test as privateTest,
} from "../../../../utils/authenticated-read-fixture";
import { sidebarNavigationLink } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import type { PreferenceFlow } from "../../../../utils/preference-flow";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

async function setLocale(
  page: Page,
  flow: PreferenceFlow,
  locale: "en-us" | "zh-cn",
) {
  const response = await flow.http(() =>
    page.request.post("/api/account/preferences", {
      data: { locale },
    }),
  );
  expect(response.status()).toBe(200);
}

async function expectWorkspacePageIdentity(
  page: Page,
  locale: "en-us" | "zh-cn",
  title: string,
) {
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page).toHaveTitle(`${title} - Life@USTC`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 1, name: title, exact: true }),
  ).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(
    page.getByRole("main", { name: title, exact: true }),
  ).toHaveCount(1);
}

test("/workspace 别名需要登录", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/workspace/homeworks");
  await captureStepScreenshot(page, testInfo, "workspace-homeworks-unauth");
});

privateTest(
  "匿名工作区重定向后仍可登录并加载标签",
  async (
    { page, isolatedWorker, privateLoginUser, loginFlow, run },
    testInfo,
  ) => {
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const credentials = await db.account.findMany();
      expect(credentials).toHaveLength(1);
      expect(await db.session.findMany()).toEqual([]);
      let loginSession: Session | undefined;
      const startedAt = Date.now();
      const writes: { method: string; path: string; status: number }[] = [];
      const expectedWrites = [
        { method: "POST", path: "/account/sign-in", status: 200 },
      ];
      await loginFlow.run(
        async () => {
          // Regression: the anonymous workspace module must not initialize Better
          // Auth in a request context that ends with the sign-in redirect.
          await expectRequiresSignIn(page, "/workspace/homeworks");
          await page
            .getByRole("button", {
              name: /Debug User \(Dev\)|调试用户（开发）/i,
            })
            .click();
          await expect(page).toHaveURL(/\/workspace\/homeworks$/);
          await gotoAndWaitForReady(page, "/workspace/homeworks", {
            testInfo,
            screenshotLabel: "workspace-homeworks",
          });
          await expect(page).toHaveURL(/\/workspace\/homeworks(?:[/?#].*)?$/);
          await expect(
            sidebarNavigationLink(page, /^(作业|Homework)$/i),
          ).toHaveAttribute("aria-current", "page");
          await captureStepScreenshot(page, testInfo, "workspace-homeworks");
        },
        { auditActions: { account_sign_in: 1 } },
        {
          async verifyBrowserWrite(response, incoming) {
            const write = {
              method: incoming.method(),
              path: new URL(incoming.url()).pathname,
              status: response.status(),
            };
            expect(write).toEqual(expectedWrites[writes.length]);
            writes.push(write);
            expect(await response.json()).toEqual({
              type: "redirect",
              status: 303,
              location: "/workspace/homeworks",
            });
            const sessions = await db.session.findMany();
            expect(sessions).toHaveLength(1);
            loginSession = sessions[0];
            expect(loginSession).toEqual({
              id: expect.any(String),
              sessionToken: expect.any(String),
              userId: privateLoginUser.id,
              ipAddress: expect.any(String),
              userAgent: expect.stringContaining("Chrome"),
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
              expires: expect.any(Date),
            });
            for (const time of [
              loginSession.createdAt.getTime(),
              loginSession.updatedAt.getTime(),
              loginSession.expires.getTime() - 30 * 86_400_000,
            ]) {
              expect(time).toBeGreaterThanOrEqual(startedAt);
              expect(time).toBeLessThanOrEqual(Date.now());
            }
          },
          async verifyTransport({ producer, sdkRequests }) {
            expect(sdkRequests).toEqual([]);
            expect(writes).toEqual(expectedWrites);
            expect(
              producer.requests
                .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
                .map(({ value, result }) => ({
                  method: value.method,
                  path: value.path,
                  status: result,
                })),
            ).toEqual(expectedWrites);
          },
          async verifyState() {
            await expectReadOnlyWorkspace(db, [privateLoginUser], []);
            if (!loginSession)
              throw new Error("Private login did not create a session");
            expect(await db.session.findMany()).toEqual([loginSession]);
            expect(await db.account.findMany()).toEqual(credentials);
            expect(await db.passkey.findMany()).toEqual([]);
            expect(await db.verifiedEmail.findMany()).toEqual([]);
            expect(
              await db.auditLog.findMany({
                select: {
                  action: true,
                  outcome: true,
                  channel: true,
                  userId: true,
                  subjectUserId: true,
                  targetId: true,
                  targetType: true,
                  sessionId: true,
                  oauthClientId: true,
                  oauthGrantId: true,
                  metadata: true,
                },
              }),
            ).toEqual([
              {
                action: "account_sign_in",
                outcome: "success",
                channel: "auth",
                userId: privateLoginUser.id,
                subjectUserId: privateLoginUser.id,
                targetId: loginSession.id,
                targetType: "session",
                sessionId: loginSession.id,
                oauthClientId: null,
                oauthGrantId: null,
                metadata: { authMethod: "password" },
              },
            ]);
          },
        },
      );
    });
  },
);

privateTest(
  "登录工作区隐藏公共页脚但公共内容页保留",
  async ({ page, isolatedWorker, preferenceFlow, run }) => {
    await run(async () => {
      const viewer = await preferenceFlow.prepare(() =>
        preparePrivateViewer(page, isolatedWorker, false),
      );
      await preferenceFlow.run(async () => {
        await gotoAndWaitForReady(page, "/workspace/overview");
        await expect(page.locator("footer")).toHaveCount(0);

        await gotoAndWaitForReady(page, "/catalog/courses");
        await expect(page.locator("footer")).toBeVisible();
      });
      await expectPrivateViewerState(isolatedWorker.database.owner, viewer, []);
    });
  },
);

privateTest(
  "查询参数别名永久跳转后使用规范化的工作台页面身份",
  async ({ page, isolatedWorker, preferenceFlow, run }) => {
    await run(async () => {
      const viewer = await preferenceFlow.prepare(() =>
        preparePrivateViewer(page, isolatedWorker, false),
      );
      await preferenceFlow.run(async () => {
        await setLocale(page, preferenceFlow, "zh-cn");
        await gotoAndWaitForReady(page, "/workspace/todos");
        await gotoAndWaitForReady(page, "/workspace?tab=todos");

        await expect(page).toHaveURL(/\/workspace\/todos$/);
        await expectWorkspacePageIdentity(page, "zh-cn", "待办");
      });
      await expectPrivateViewerState(isolatedWorker.database.owner, viewer, []);
    });
  },
);

privateTest(
  "页面契约",
  async ({ page, isolatedWorker, preferenceFlow, run }, testInfo) => {
    await run(async () => {
      const viewer = await preferenceFlow.prepare(() =>
        preparePrivateViewer(page, isolatedWorker, false),
      );
      await preferenceFlow.run(async () => {
        await assertPageContract(page, {
          routePath: "/workspace/overview",
          testInfo,
        });
      });
      await expectPrivateViewerState(isolatedWorker.database.owner, viewer, []);
    });
  },
);

privateTest(
  "页面契约 /workspace",
  async ({ page, isolatedWorker, preferenceFlow, run }, testInfo) => {
    await run(async () => {
      const viewer = await preferenceFlow.prepare(() =>
        preparePrivateViewer(page, isolatedWorker, false),
      );
      await preferenceFlow.run(async () => {
        await assertPageContract(page, { routePath: "/workspace", testInfo });
      });
      await expectPrivateViewerState(isolatedWorker.database.owner, viewer, []);
    });
  },
);
