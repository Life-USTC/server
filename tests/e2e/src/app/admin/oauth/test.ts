/**
 * E2E tests for /admin/oauth — compact OAuth client administration.
 *
 * Covers the single inventory, the three fixed creation patterns, one-time
 * credentials, confirmed deletion, disabled state, and mobile rendering.
 */
import { expect, type Locator, type Page } from "@playwright/test";
import type { TestPrismaClient } from "../../../../../shared/prisma";
import { adminWriteChecks, test } from "../../../../utils/admin-fixture";
import { expectRequiresSignIn } from "../../../../utils/auth";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

async function createClient(
  db: TestPrismaClient,
  origin: string,
  options: {
    name: string;
    scopes?: string[];
    tokenEndpointAuthMethod?: "none";
    disabled?: boolean;
  },
) {
  const method = options.tokenEndpointAuthMethod ?? "client_secret_basic";
  return db.oAuthClient.create({
    data: {
      name: options.name,
      clientId: crypto.randomUUID(),
      clientSecret: crypto.randomUUID(),
      tokenEndpointAuthMethod: method,
      type: method === "none" ? "public" : "web",
      redirectUris: [`${origin}/oauth-e2e/callback`],
      scopes: options.scopes ?? ["openid"],
      grantTypes:
        method === "none"
          ? ["authorization_code"]
          : ["authorization_code", "refresh_token"],
      responseTypes: ["code"],
      requirePKCE: true,
      disabled: options.disabled ?? false,
    },
  });
}

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

test("/admin/oauth 普通用户访问返回 403", async ({
  pageRun,
  page,
  account: _account,
}, testInfo) => {
  await pageRun(
    async () => {
      await gotoAndWaitForReady(page, "/admin/oauth");
      await expect(page.getByText("403").first()).toBeVisible();
      await expect(page.getByText("Forbidden").first()).toBeVisible();
      await captureStepScreenshot(page, testInfo, "admin-oauth-403");
    },
    async () => {
      throw new Error("Read-only authorization case submitted a browser write");
    },
  );
});

test("oauth.client-authentication-inventory", async ({
  adminFlow,
  run,
  page,
  isolatedWorker,
  admin: _admin,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        test.setTimeout(90_000);
        const prefix = `e2e-oauth-pattern-${crypto.randomUUID()}`;
        const names = CLIENT_PATTERNS.map(
          ({ suffix }) => `${prefix}-${suffix}`,
        );
        const secrets: string[] = [];

        await gotoAndWaitForReady(page, "/admin/oauth");
        await expect(
          page.getByRole("heading", {
            name: /OAuth 客户端管理|OAuth Clients/i,
          }),
        ).toBeVisible();

        for (const [index, pattern] of CLIENT_PATTERNS.entries()) {
          if (index > 0) await gotoAndWaitForReady(page, "/admin/oauth");
          const name = names[index];
          const dialog = await openCreateDialog(page);
          await expect(
            dialog.getByRole("button", { name: /取消|Cancel/i }),
          ).toBeVisible();
          await dialog.getByRole("radio", { name: pattern.choice }).click();
          await dialog.getByLabel(/应用名称|Application Name/i).fill(name);
          await dialog
            .getByLabel(/重定向 URI|Redirect URIs/i)
            .fill(
              pattern.method === "none"
                ? `${isolatedWorker.origin}/oauth-e2e/${pattern.suffix}/callback`
                : `https://client.example/oauth-e2e/${pattern.suffix}/callback`,
            );

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

          const doneButton = credentialsDialog.getByRole("button", {
            name: /完成|Done/i,
          });
          const savedAcknowledgement = credentialsDialog.getByRole("checkbox", {
            name: /我已安全保存客户端密钥|I have saved the client secret securely/i,
          });
          if (pattern.expectSecret) {
            await expect(doneButton).toBeDisabled();
            await page.keyboard.press("Escape");
            await expect(credentialsDialog).toBeVisible();
            await savedAcknowledgement.click();
            await expect(savedAcknowledgement).toBeChecked();
            await expect(doneButton).toBeEnabled();
          } else {
            await expect(savedAcknowledgement).toHaveCount(0);
            await expect(doneButton).toBeEnabled();
          }

          const persisted =
            await isolatedWorker.database.owner.oAuthClient.findFirst({
              where: { name },
            });
          expect(persisted).toMatchObject({
            disabled: false,
            enableEndSession: pattern.enableEndSession,
            requirePKCE: true,
            skipConsent: pattern.skipConsent,
            tokenEndpointAuthMethod: pattern.method,
          });
          expect(persisted?.scopes).toContain("email");

          await doneButton.click();
          await expect(credentialsDialog).toBeHidden();
          if (secret) {
            await expect(page.getByText(secret, { exact: true })).toHaveCount(
              0,
            );
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
      },
      { auditActions: { admin_oauth_client_create: 3 } },
      adminWriteChecks([
        ["POST", "/admin/oauth", 200],
        ["POST", "/admin/oauth", 200],
        ["POST", "/admin/oauth", 200],
      ]),
    ),
  );
});

test("/admin/oauth 显示 disabled 客户端并确认删除", async ({
  adminFlow,
  run,
  page,
  isolatedWorker,
  admin: _admin,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        const name = `e2e-oauth-disabled-${crypto.randomUUID()}`;

        const client = await createClient(
          isolatedWorker.database.owner,
          isolatedWorker.origin,
          { name, disabled: true },
        );
        await gotoAndWaitForReady(page, "/admin/oauth");

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
        await deleteDialog
          .getByRole("button", { name: /取消|Cancel/i })
          .click();
        await expect(deleteDialog).toBeHidden();
        expect(
          await isolatedWorker.database.owner.oAuthClient.findUnique({
            where: { id: client.id },
          }),
        ).not.toBeNull();

        await row.getByRole("button", { name: /删除|Delete/i }).click();
        await deleteDialog
          .getByRole("button", { name: /删除|Delete/i })
          .click();

        await expect(page.getByText(name)).toHaveCount(0, { timeout: 15_000 });
        expect(
          await isolatedWorker.database.owner.oAuthClient.findUnique({
            where: { id: client.id },
          }),
        ).toBeNull();
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-oauth/disabled-delete",
        );
      },
      { auditActions: { admin_oauth_client_delete: 1 } },
      adminWriteChecks([["POST", "/admin/oauth", 200]]),
    ),
  );
});

test("/admin/oauth 桌面表格保持徽标单行并为 scopes 溢出提供完整提示", async ({
  adminFlow,
  run,
  page,
  isolatedWorker,
  admin: _admin,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        const prefix = `e2e-oauth-table-${crypto.randomUUID()}`;
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
          `overflow-probe:${"scope-token-".repeat(24)}`,
        ];

        await createClient(
          isolatedWorker.database.owner,
          isolatedWorker.origin,
          {
            name: longName,
            scopes: longScopes,
          },
        );
        await createClient(
          isolatedWorker.database.owner,
          isolatedWorker.origin,
          {
            name: shortName,
            scopes: ["openid"],
          },
        );
        await page.setViewportSize({ width: 1440, height: 900 });
        await gotoAndWaitForReady(page, "/admin/oauth");

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
          scopesGeometry.clientWidth,
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
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-oauth/table-overflow",
        );
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/oauth 移动端使用紧凑列表且无页面横向溢出", async ({
  adminFlow,
  run,
  page,
  isolatedWorker,
  admin: _admin,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        const name = `e2e-oauth-mobile-${crypto.randomUUID()}`;

        const client = await createClient(
          isolatedWorker.database.owner,
          isolatedWorker.origin,
          {
            name,
            tokenEndpointAuthMethod: "none",
          },
        );
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoAndWaitForReady(page, "/admin/oauth");

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
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("页面契约", async ({ adminFlow, run, page, admin: _admin }, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        const response = await gotoAndWaitForReady(page, "/admin/oauth", {
          browserHealth: {},
          expectMeaningfulContent: true,
          expectNoHorizontalOverflow: true,
          uiQuality: {},
          testInfo,
        });
        expect(response?.ok()).toBe(true);
        await expect(page.locator("#main-content")).toBeVisible();
        await expect(
          page.getByRole("heading", { name: /OAuth|OAuth 客户端/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: CREATE_BUTTON }).first(),
        ).toBeVisible();
      },
      {},
      adminWriteChecks([]),
    ),
  );
});
