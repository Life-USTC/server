/**
 * E2E tests for /admin/oauth — OAuth Client Management
 *
 * ## Data Represented (admin.yml → oauth-client-management.display.fields)
 * - client.name
 * - client.clientId
 * - client.redirectUris[]
 * - client.scopes[]
 * - client.tokenEndpointAuthMethod
 * - client.isTrusted
 * - Action: delete
 *
 * ## Features
 * - Create client with name + redirect URIs → shows clientId and secret
 * - Delete client
 *
 * ## Edge Cases
 * - Unauthenticated → /signin
 * - Non-admin → 404
 */
import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../utils/auth";
import {
  deleteOAuthClientsByName,
  PLAYWRIGHT_BASE_URL,
} from "../../../../utils/e2e-db";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe.configure({ mode: "serial" });

test("/admin/oauth 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/admin/oauth");
  await captureStepScreenshot(page, testInfo, "admin-oauth-unauthorized");
});

test("/admin/oauth 普通用户访问返回 404", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/admin/oauth", "/admin/oauth");
  await expect(page.locator("h1")).toHaveText("404");
  await captureStepScreenshot(page, testInfo, "admin-oauth-404");
});

test("/admin/oauth 管理员可创建并删除客户端", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const clientName = `e2e-oauth-client-${Date.now()}`;

  try {
    await signInAsDevAdmin(page, "/admin/oauth");

    await expect(
      page.getByRole("heading", { name: /OAuth 客户端管理|OAuth Clients/i }),
    ).toBeVisible();

    const createBtn = page
      .getByRole("button", { name: /创建客户端|Create Client/i })
      .first();
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeEnabled();
    const createDialog = page
      .locator(
        '[role="dialog"]:not([data-nextjs-dialog]), [data-slot="dialog-popup"]',
      )
      .last();
    await expect(async () => {
      await createBtn.click();
      await expect(createDialog).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });
    await createDialog
      .getByLabel(/应用名称|Application Name/i)
      .fill(clientName);
    await createDialog
      .getByLabel(/重定向 URI|Redirect URIs/i)
      .fill(`${PLAYWRIGHT_BASE_URL}/oauth-e2e/callback`);

    await createDialog
      .getByRole("button", { name: /创建客户端|Create Client/i })
      .click();

    await expect(page.getByText(clientName).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByRole("button", { name: /复制 ID|Copy ID/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /复制密钥|Copy secret/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Verify your identity|验证您的身份/i).first(),
    ).toBeVisible();
    await expect(
      page
        .getByText(/Call MCP tools on your behalf|代表您调用 MCP 工具/i)
        .first(),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "admin-oauth-created");

    await page.getByRole("button", { name: /完成|Done/i }).click();

    const clientCard = page
      .locator("article")
      .filter({
        has: page.getByText(clientName, { exact: true }),
      })
      .first();
    await expect(clientCard).toBeVisible();
    await clientCard.getByRole("button", { name: /删除|Delete/i }).click();

    await expect(page.getByText(clientName)).toHaveCount(0, {
      timeout: 15000,
    });
    await captureStepScreenshot(page, testInfo, "admin-oauth-deleted");
  } finally {
    await deleteOAuthClientsByName(clientName);
  }
});

test("/admin/oauth created client shows all required fields", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const clientName = `e2e-fields-client-${Date.now()}`;

  try {
    // Force fresh sign-in (ui:true) to avoid stale auth-cache from previous test
    await signInAsDevAdmin(page, "/admin/oauth", "/admin/oauth", { ui: true });

    const createBtn = page
      .getByRole("button", { name: /创建客户端|Create Client/i })
      .first();
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeEnabled();
    const createDialog = page
      .locator(
        '[role="dialog"]:not([data-nextjs-dialog]), [data-slot="dialog-popup"]',
      )
      .last();
    await expect(async () => {
      await createBtn.click();
      await expect(createDialog).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

    await createDialog
      .getByLabel(/应用名称|Application Name/i)
      .fill(clientName);
    await createDialog
      .getByLabel(/重定向 URI|Redirect URIs/i)
      .fill(`${PLAYWRIGHT_BASE_URL}/oauth-e2e-fields/callback`);

    await createDialog
      .getByRole("button", { name: /创建客户端|Create Client/i })
      .click();

    const clientCard = page
      .locator("article, [class*='rounded']")
      .filter({
        has: page.getByText(clientName, { exact: true }),
      })
      .first();
    await expect(clientCard).toBeVisible({ timeout: 15_000 });

    // client.name (admin.yml oauth-client-management.display.fields)
    await expect(clientCard.getByText(clientName)).toBeVisible();
    // client.clientId — "Copy ID" button implies clientId is shown/copyable
    await expect(
      clientCard.getByRole("button", { name: /复制 ID|Copy ID/i }).first(),
    ).toBeVisible();
    // client.redirectUris[] — the registered callback URL
    await expect(
      clientCard
        .getByText(/oauth-e2e-fields\/callback/i)
        .first()
        .or(page.getByText(/oauth-e2e-fields\/callback/i).first()),
    ).toBeVisible();
    // client.scopes[] — default scopes shown
    await expect(
      page.getByText(/openid|profile|Verify your identity/i).first(),
    ).toBeVisible();
    // tokenEndpointAuthMethod — public/confidential indicator
    await expect(
      page.getByText(/Public|Confidential|公开|机密/i).first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "admin-oauth/client-fields");
  } finally {
    await deleteOAuthClientsByName(clientName);
  }
});
