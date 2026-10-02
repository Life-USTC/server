/**
 * E2E tests for the Settings Accounts section (`/account/settings/accounts`)
 *
 * ## Data Represented
 * - `/account/settings/accounts` is the canonical linked-account settings entry.
 * - Shows linked OAuth provider accounts for the current user.
 * - Three providers: GitHub, Google, USTC (OIDC).
 * - Each provider card shows: name, "Connected" badge (if linked),
 *   and a Connect or Disconnect button.
 *
 * ## UI/UX Elements
 * - Card with title "Linked Accounts" / "关联账号"
 * - Per-provider row: provider name, connected badge, action button
 * - Connect button → starts OAuth account-linking flow (redirects to `/api/auth/...`)
 * - Disconnect button → opens confirmation dialog with Cancel + Disconnect
 * - When only 1 account linked: Disconnect is disabled + warning text
 * - Toast notifications for link/unlink success/error
 *
 * ## Edge Cases
 * - Unauthenticated → redirects to /signin
 * - Only one linked account → Disconnect disabled, warning shown
 * - Cancel in unlink dialog → dialog closes, account stays linked
 * - Confirm unlink → account removed, button changes to Connect
 */
import { expect } from "@playwright/test";
import { expectPagePath, expectRequiresSignIn } from "../../../../utils/auth";
import { observeAction } from "../../../../utils/observed-action";

import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { expectSettingsPage, test } from "../../../../utils/settings-fixture";
import { test as oauthTest } from "../../../../utils/settings-oauth-fixture";

test.describe.configure({ mode: "parallel" });

test.describe("/account/settings/accounts 关联账号设置", () => {
  test("需要登录", async ({ accountRun, page }, testInfo) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await expectRequiresSignIn(page, "/account/settings/accounts");
      await captureStepScreenshot(
        page,
        testInfo,
        "settings-accounts-unauthorized",
      );
    });
  });

  test("显示所有提供商卡片", async ({
    accountRun,
    page,
    account: _account,
  }, testInfo) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await gotoAndWaitForReady(page, "/account/settings/accounts");

      await expectPagePath(page, "/account/settings/accounts");
      await expect(page.getByText("GitHub").first()).toBeVisible();
      await expect(page.getByText("Google").first()).toBeVisible();
      await expect(page.getByText("USTC", { exact: true }).first()).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "settings-accounts-platforms",
      );
    });
  });

  oauthTest(
    "连接按钮启动账号关联 OAuth 流程",
    async (
      { accountRun, page, account, isolatedWorker, authorizationProvider },
      testInfo,
    ) => {
      let authorizationHref: string | undefined;
      await accountRun(
        {
          writes: [["/account/settings/accounts", 200, "linkAccount"]],
          audits: [],
          async verifyWrite(response) {
            // Inspect the genuine Worker response before the owned proxy
            // fulfills it and the browser leaves this document.
            const result = await response.json();
            expect(result.type).toBe("redirect");
            expect(result.status).toBe(303);
            const authorization = new URL(result.location);
            expect(authorization.origin).toBe(authorizationProvider.origin);
            expect(authorization.pathname).toBe("/authorize/");
            const parameters = authorization.searchParams;
            expect(parameters.get("client_id")).toBe(
              authorizationProvider.clientId,
            );
            expect(parameters.get("redirect_uri")).toBe(
              `${isolatedWorker.origin}/api/auth/callback/oidc`,
            );
            expect(parameters.get("response_type")).toBe("code");
            expect(parameters.get("scope")?.split(" ").sort()).toEqual([
              "openid",
            ]);
            expect(Boolean(parameters.get("state"))).toBe(true);
            expect(parameters.get("code_challenge_method")).toBe("S256");
            expect(
              /^[A-Za-z0-9_-]{43}$/.test(
                parameters.get("code_challenge") ?? "",
              ),
            ).toBe(true);
            expect(parameters.has("client_secret")).toBe(false);
            expect(parameters.has("code_verifier")).toBe(false);
            authorizationHref = authorization.href;
          },
        },
        async () => {
          await gotoAndWaitForReady(page, "/account/settings/accounts");

          const providerCard = page
            .locator("#main-content .rounded-lg.border")
            .filter({ has: page.getByText("USTC", { exact: true }) })
            .first();
          const connectButton = providerCard.getByRole("button", {
            name: /连接|Connect/i,
          });
          await expect(providerCard).toBeVisible();
          await expect(connectButton).toBeVisible();

          await waitForUiSettled(page);
          await expect(connectButton).toBeEnabled();

          const response = await observeAction(
            () =>
              page.waitForResponse(
                (response) => {
                  const request = response.request();
                  const url = new URL(request.url());
                  return (
                    request.method() === "POST" &&
                    url.origin === isolatedWorker.origin &&
                    url.pathname === "/account/settings/accounts" &&
                    url.search === "?/linkAccount"
                  );
                },
                { timeout: 15_000 },
              ),
            () => connectButton.click(),
          );
          expect(response.status()).toBe(200);
          await page.waitForURL(
            (url) =>
              url.origin === authorizationProvider.origin &&
              url.pathname === "/authorize/",
          );
          await expect(
            page.getByRole("heading", {
              name: "Authorize account connection",
              exact: true,
            }),
          ).toBeVisible();
          expect(authorizationProvider.requests.length).toBe(1);
          // Compare opaque state only in memory; do not print it in diagnostics.
          expect(
            authorizationProvider.requests[0].href === authorizationHref,
          ).toBe(true);
          await captureStepScreenshot(
            page,
            testInfo,
            "settings-accounts-oauth",
          );
          return async () => {
            expect(
              await isolatedWorker.database.owner.account.count({
                where: { userId: account.id },
              }),
            ).toBe(0);
            expect(
              await isolatedWorker.database.owner.user.findMany({
                orderBy: { id: "asc" },
              }),
            ).toEqual([account]);
          };
        },
      );
    },
  );

  test("仅关联一个账号时断开连接被禁用", async ({
    accountRun,
    page,
    account: _account,
    ustcAccount: _ustcAccount,
  }, testInfo) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await gotoAndWaitForReady(page, "/account/settings/accounts");
      const providerCard = page
        .locator("#main-content .rounded-lg.border")
        .filter({ has: page.getByText("USTC", { exact: true }) })
        .first();
      const disconnectButton = providerCard.getByRole("button", {
        name: /断开连接|Disconnect/i,
      });

      await expect(disconnectButton).toBeVisible();
      await expect(disconnectButton).toBeDisabled();
      await expect(
        providerCard.getByText(
          /至少.*登录方式|Keep at least one usable sign-in method/i,
        ),
      ).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "settings-accounts-disconnect-disabled",
      );
    });
  });

  test("多账号：取消与确认解绑流程", async ({
    accountRun,
    page,
    account,
    ustcAccount: _ustcAccount,
    githubAccount: _githubAccount,
    credential: _credential,
    isolatedWorker,
  }, testInfo) => {
    test.setTimeout(60_000);
    await accountRun(
      {
        writes: [
          [
            "/account/settings/accounts",
            200,
            "unlinkAccount",
            "/account/settings/accounts?message=AccountDisconnected",
          ],
        ],
        audits: ["account_unlink"],
      },
      async () => {
        await gotoAndWaitForReady(page, "/account/settings/accounts");
        await waitForUiSettled(page);
        await expectPagePath(page, "/account/settings/accounts");

        const providerCard = page
          .locator("#main-content .rounded-lg.border")
          .filter({ has: page.getByText("GitHub", { exact: true }) })
          .first();
        await expect(providerCard).toBeVisible();

        const disconnectButton = providerCard.getByRole("button", {
          name: /断开连接|Disconnect/i,
        });
        await expect(disconnectButton).toBeEnabled();

        // Cancel flow
        await disconnectButton.click();
        const dialog = page
          .getByRole("dialog")
          .or(page.getByRole("alertdialog"))
          .first();
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
        await expect(dialog).not.toBeVisible();
        expect(
          await isolatedWorker.database.owner.account.count({
            where: { userId: account.id, provider: "github" },
          }),
        ).toBe(1);

        // Confirm unlink flow
        await disconnectButton.click();
        await expect(dialog).toBeVisible();
        await dialog
          .getByRole("button", { name: /断开连接|Disconnect/i })
          .click();

        await expect(dialog).not.toBeVisible({ timeout: 15_000 });
        await expect(
          providerCard.getByRole("button", { name: /连接|Connect/i }),
        ).toBeVisible({ timeout: 15_000 });
        await expect(
          providerCard.getByRole("button", {
            name: /断开连接|Disconnect/i,
          }),
        ).toHaveCount(0);
        await expect(page).toHaveURL(/\/account\/settings\/accounts$/);
        await expect(
          page
            .locator("[data-sonner-toast]")
            .filter({ hasText: /已断开连接|Disconnected/i }),
        ).toBeVisible();
        expect(
          await isolatedWorker.database.owner.account.count({
            where: { userId: account.id, provider: "github" },
          }),
        ).toBe(0);
        expect(
          await isolatedWorker.database.owner.verifiedEmail.count({
            where: { userId: account.id, provider: "github" },
          }),
        ).toBe(0);
        expect(
          await isolatedWorker.database.owner.account.count({
            where: { userId: account.id, provider: "oidc" },
          }),
        ).toBe(1);
        await captureStepScreenshot(
          page,
          testInfo,
          "settings-accounts-unlinked",
        );
      },
    );
  });
});

test("页面契约", async ({ accountRun, page, account: _account }, testInfo) => {
  await accountRun({ writes: [], audits: [] }, async () => {
    await expectSettingsPage(page, "/account/settings/accounts", testInfo);
    await expect(
      page.getByRole("region", { name: /关联账户|Linked accounts/i }),
    ).toBeVisible();
  });
});
