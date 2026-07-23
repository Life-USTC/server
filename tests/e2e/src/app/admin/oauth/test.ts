/**
 * E2E tests for /admin/oauth — compact OAuth client administration.
 *
 * Covers the single inventory, the three fixed creation patterns, one-time
 * credentials, confirmed deletion, disabled state, and mobile rendering.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../utils/auth";
import {
  createOAuthClientFixture,
  deleteOAuthClientsByName,
  disableOAuthClientByName,
  getOAuthClientByName,
  PLAYWRIGHT_BASE_URL,
} from "../../../../utils/e2e-db";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe.configure({ mode: "serial" });

const CREATE_BUTTON = /创建客户端|Create Client/i;
const CREDENTIALS_DIALOG = /客户端凭据|Client Credentials/i;

const CLIENT_PATTERNS = [
  {
    suffix: "trusted",
    choice: /可信第一方应用|Trusted First-Party App/i,
    method: "client_secret_basic",
    skipConsent: true,
    enableEndSession: true,
    expectSecret: true,
    typeLabel: /机密客户端（Basic 认证）|Confidential \(Basic auth\)/i,
    trustLabel: /可信|Trusted/i,
  },
  {
    suffix: "public",
    choice: /MCP \/ 原生应用 \/ CLI|MCP, Native, Or CLI/i,
    method: "none",
    skipConsent: false,
    enableEndSession: false,
    expectSecret: false,
    typeLabel: /公共客户端（PKCE）|Public \(PKCE\)/i,
    trustLabel: /需用户授权|Consent required/i,
  },
  {
    suffix: "external",
    choice: /外部机密连接器|External Confidential Connector/i,
    method: "client_secret_post",
    skipConsent: false,
    enableEndSession: false,
    expectSecret: true,
    typeLabel:
      /机密客户端（请求体携带密钥）|Confidential \(client secret in body\)/i,
    trustLabel: /需用户授权|Consent required/i,
  },
] as const;

async function openCreateDialog(page: Page) {
  await page.getByRole("button", { name: CREATE_BUTTON }).first().click();
  const dialog = page.getByRole("dialog", { name: CREATE_BUTTON });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function readClientSecret(
  credentialsDialog: Locator,
  expectSecret: boolean,
) {
  const secretField = credentialsDialog
    .locator('[data-slot="item"]')
    .filter({ hasText: /客户端密钥|Client Secret/i });
  const value = (
    await secretField.locator('[data-slot="item-description"]').textContent()
  )?.trim();

  if (expectSecret) {
    expect(value).toBeTruthy();
    await expect(
      secretField.getByRole("button", { name: /复制密钥|Copy secret/i }),
    ).toBeVisible();
  } else {
    await expect(
      secretField.getByText(
        /公共客户端不会签发客户端密钥|No client secret is issued for public clients/i,
      ),
    ).toBeVisible();
    await expect(
      secretField.getByRole("button", { name: /复制密钥|Copy secret/i }),
    ).toHaveCount(0);
  }

  return expectSecret ? value : undefined;
}

test("/admin/oauth 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/admin/oauth");
  await captureStepScreenshot(page, testInfo, "admin-oauth-unauthorized");
});

test("/admin/oauth 普通用户访问返回 404", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/admin/oauth", "/admin/oauth");
  await expect(page.getByText("404").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
  ).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin-oauth-404");
});

test("/admin/oauth 可创建三种固定客户端且密钥只显示一次", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const prefix = `e2e-oauth-pattern-${Date.now()}`;
  const names = CLIENT_PATTERNS.map(({ suffix }) => `${prefix}-${suffix}`);
  const secrets: string[] = [];

  try {
    await signInAsDevAdmin(page, "/admin/oauth");
    await expect(
      page.getByRole("heading", { name: /OAuth 客户端管理|OAuth Clients/i }),
    ).toBeVisible();

    for (const [index, pattern] of CLIENT_PATTERNS.entries()) {
      const name = names[index];
      const dialog = await openCreateDialog(page);
      await expect(
        dialog.getByRole("button", { name: /取消|Cancel/i }),
      ).toBeVisible();
      await dialog.getByRole("radio", { name: pattern.choice }).click();
      await dialog.getByLabel(/应用名称|Application Name/i).fill(name);
      await dialog
        .getByLabel(/重定向 URI|Redirect URIs/i)
        .fill(`${PLAYWRIGHT_BASE_URL}/oauth-e2e/${pattern.suffix}/callback`);

      const emailScope = dialog.getByRole("checkbox", {
        name: /查看您的邮箱地址|View your email address/i,
      });
      if ((await emailScope.getAttribute("data-state")) !== "checked") {
        await emailScope.click();
      }

      await dialog.getByRole("button", { name: CREATE_BUTTON }).click();

      const credentialsDialog = page.getByRole("dialog", {
        name: CREDENTIALS_DIALOG,
      });
      await expect(credentialsDialog).toBeVisible({ timeout: 15_000 });
      const secret = await readClientSecret(
        credentialsDialog,
        pattern.expectSecret,
      );
      if (secret) secrets.push(secret);

      const persisted = await getOAuthClientByName(name);
      expect(persisted).toMatchObject({
        disabled: false,
        enableEndSession: pattern.enableEndSession,
        requirePKCE: true,
        skipConsent: pattern.skipConsent,
        tokenEndpointAuthMethod: pattern.method,
      });
      expect(persisted?.scopes).toContain("email");

      await credentialsDialog
        .getByRole("button", { name: /完成|Done/i })
        .click();
      await expect(credentialsDialog).toBeHidden();
      if (secret) {
        await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
      }

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      if (index === 0) {
        await expect(
          page.getByRole("columnheader", { name: /客户端|Client/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("columnheader", {
            name: /信任 \/ 类型|Trust \/ Type/i,
          }),
        ).toBeVisible();
      }
      await expect(row).toContainText(persisted?.clientId ?? "");
      await expect(row.getByText(pattern.typeLabel)).toBeVisible();
      await expect(
        row
          .locator('[data-slot="badge"]')
          .filter({ hasText: pattern.trustLabel }),
      ).toBeVisible();
      await expect(row.getByText(/已启用|Enabled/i)).toBeVisible();
      await expect(
        row.locator("td").nth(2).locator('[data-slot="truncated-text"]'),
      ).toContainText("openid");
    }

    await gotoAndWaitForReady(page, "/admin/oauth");
    for (const secret of secrets) {
      await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
    }
    await expectNoPageHorizontalOverflow(page);

    await captureStepScreenshot(page, testInfo, "admin-oauth/simple-table");
  } finally {
    for (const name of names) {
      await deleteOAuthClientsByName(name);
    }
  }
});

test("/admin/oauth 显示 disabled 客户端并确认删除", async ({
  page,
}, testInfo) => {
  const name = `e2e-oauth-disabled-${Date.now()}`;

  try {
    await createOAuthClientFixture({ name });
    await disableOAuthClientByName(name);
    await signInAsDevAdmin(page, "/admin/oauth");

    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(
      row
        .locator('[data-slot="badge"]')
        .filter({ hasText: /已禁用|Disabled/i }),
    ).toBeVisible();
    await row.getByRole("button", { name: /删除|Delete/i }).click();

    const deleteDialog = page.getByRole("alertdialog", {
      name: /删除客户端|Delete client|删除|Delete/i,
    });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: /取消|Cancel/i }).click();
    await expect(deleteDialog).toBeHidden();
    expect(await getOAuthClientByName(name)).not.toBeNull();

    await row.getByRole("button", { name: /删除|Delete/i }).click();
    await deleteDialog.getByRole("button", { name: /删除|Delete/i }).click();

    await expect(page.getByText(name)).toHaveCount(0, { timeout: 15_000 });
    expect(await getOAuthClientByName(name)).toBeNull();
    await captureStepScreenshot(page, testInfo, "admin-oauth/disabled-delete");
  } finally {
    await deleteOAuthClientsByName(name);
  }
});

test("/admin/oauth 桌面表格保持徽标单行并为 scopes 溢出提供完整提示", async ({
  page,
}, testInfo) => {
  const prefix = `e2e-oauth-table-${Date.now()}`;
  const longName = `${prefix}-long`;
  const shortName = `${prefix}-short`;
  const longScopes = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "calendar:read",
    "calendar:write",
    "subscriptions:read",
    "subscriptions:write",
  ];

  try {
    await createOAuthClientFixture({ name: longName, scopes: longScopes });
    await createOAuthClientFixture({ name: shortName, scopes: ["openid"] });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAsDevAdmin(page, "/admin/oauth");

    const longRow = page.getByRole("row").filter({ hasText: longName });
    const shortRow = page.getByRole("row").filter({ hasText: shortName });
    await expect(longRow).toBeVisible();
    await expect(shortRow).toBeVisible();

    const typeBadges = longRow
      .locator("td")
      .nth(1)
      .locator('[data-slot="badge"]');
    await expect(typeBadges).toHaveCount(3);
    const badgeTops = await typeBadges.evaluateAll((badges) =>
      badges.map((badge) => badge.getBoundingClientRect().top),
    );
    expect(Math.max(...badgeTops) - Math.min(...badgeTops)).toBeLessThan(1);

    const scopesText = longRow
      .locator("td")
      .nth(2)
      .locator('[data-slot="truncated-text"]');
    const scopesGeometry = await scopesText.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }));
    expect(scopesGeometry.scrollWidth).toBeGreaterThan(
      scopesGeometry.clientWidth + 1,
    );
    await scopesText.hover();
    await expect(
      page.locator('[data-slot="tooltip-content"]:visible'),
    ).toHaveText(longScopes.join(", "));

    const [longBox, shortBox] = await Promise.all([
      longRow.boundingBox(),
      shortRow.boundingBox(),
    ]);
    expect(
      Math.abs((longBox?.height ?? 0) - (shortBox?.height ?? 0)),
    ).toBeLessThan(1);
    await captureStepScreenshot(page, testInfo, "admin-oauth/table-overflow");
  } finally {
    await deleteOAuthClientsByName(longName);
    await deleteOAuthClientsByName(shortName);
  }
});

test("/admin/oauth 移动端使用紧凑列表且无页面横向溢出", async ({
  page,
}, testInfo) => {
  const name = `e2e-oauth-mobile-${Date.now()}`;

  try {
    const client = await createOAuthClientFixture({
      name,
      tokenEndpointAuthMethod: "none",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDevAdmin(page, "/admin/oauth");

    const item = page.getByRole("listitem").filter({ hasText: name });
    await expect(item).toBeVisible();
    await expect(item).toContainText(client.clientId);
    await expect(
      item.getByText(/公共客户端（PKCE）|Public \(PKCE\)/i),
    ).toBeVisible();
    await expect(item.getByText(/已启用|Enabled/i)).toBeVisible();
    await expect(item.getByText("openid", { exact: true })).toBeVisible();
    await expect(item.getByText(/创建时间|Created/i)).toBeVisible();
    await expect(
      item.getByRole("button", { name: /删除|Delete/i }),
    ).toBeVisible();
    await expectNoPageHorizontalOverflow(page);

    await captureStepScreenshot(page, testInfo, "admin-oauth/mobile-list");
  } finally {
    await deleteOAuthClientsByName(name);
  }
});
