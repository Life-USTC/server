import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import {
  deletePasskeysForUserFixture,
  getCurrentSessionUser,
} from "../../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe("/settings/accounts 通行密钥", () => {
  test.describe.configure({ mode: "serial" });

  test("注册、退出、通行密钥登录、重命名和删除", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 1000 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    const { authenticatorId } = await cdp.send(
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
    );

    await signInAsDebugUser(page, "/settings/accounts", undefined, {
      ui: true,
    });
    const user = await getCurrentSessionUser(page);
    await deletePasskeysForUserFixture(user.id);

    try {
      await gotoAndWaitForReady(page, "/settings/accounts");
      const passkeyCard = page.locator("[data-passkey-settings]");
      await expect(passkeyCard).toBeVisible();

      await passkeyCard
        .getByLabel(/通行密钥名称|Passkey name/i)
        .fill("E2E laptop");
      await passkeyCard
        .getByRole("button", { name: /添加通行密钥|Add passkey/i })
        .click();

      await expect(
        passkeyCard.getByText(/通行密钥已添加|Passkey added/i),
      ).toBeVisible();
      await expect(
        passkeyCard.getByLabel(/重命名 E2E laptop|Rename E2E laptop/i),
      ).toHaveValue("E2E laptop");
      const credentials = await cdp.send("WebAuthn.getCredentials", {
        authenticatorId,
      });
      expect(credentials.credentials).toHaveLength(1);
      await passkeyCard.scrollIntoViewIfNeeded();
      await captureStepScreenshot(
        page,
        testInfo,
        "settings-passkeys/registered",
      );

      const nameInput = passkeyCard.getByLabel(
        /重命名 E2E laptop|Rename E2E laptop/i,
      );
      await nameInput.fill("E2E security key");
      await passkeyCard
        .getByRole("button", { name: /保存名称|Save name/i })
        .click();
      await expect(
        passkeyCard.getByText(/通行密钥名称已更新|Passkey name updated/i),
      ).toBeVisible();
      await expect(
        passkeyCard.getByLabel(
          /重命名 E2E security key|Rename E2E security key/i,
        ),
      ).toHaveValue("E2E security key");

      await page.locator("#app-user-menu").getByRole("button").click();
      await page.getByRole("menuitem", { name: /登出|Sign Out/i }).click();
      await expect(page).toHaveURL(/\/(?:\?.*)?$/);

      await gotoAndWaitForReady(
        page,
        "/signin?callbackUrl=%2Fsettings%2Faccounts",
      );
      await page
        .getByRole("button", {
          name: /使用通行密钥登录|Sign in with a passkey/i,
        })
        .click();
      await expect(page).toHaveURL(/\/settings\/accounts(?:\?.*)?$/);
      await expect(
        page
          .locator("[data-passkey-settings]")
          .getByLabel(/重命名 E2E security key|Rename E2E security key/i),
      ).toHaveValue("E2E security key");
      await page.locator("[data-passkey-settings]").scrollIntoViewIfNeeded();
      await captureStepScreenshot(
        page,
        testInfo,
        "settings-passkeys/passkey-login",
      );

      const passkeyRow = page
        .locator('[data-slot="item"]')
        .filter({
          has: page.getByLabel(
            /重命名 E2E security key|Rename E2E security key/i,
          ),
        })
        .first();
      await passkeyRow.getByRole("button", { name: /删除|Delete/i }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /删除|Delete/i }).click();
      await expect(
        page.getByText(/尚未添加通行密钥|No passkeys yet/i),
      ).toBeVisible();
    } finally {
      await deletePasskeysForUserFixture(user.id);
      await cdp.send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId,
      });
      await cdp.send("WebAuthn.disable");
    }
  });

  test("不支持 WebAuthn 时禁用登录并解释原因", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "PublicKeyCredential", {
        configurable: true,
        value: undefined,
      });
    });

    const zhLocaleResponse = await page.request.post("/api/locale", {
      data: { locale: "zh-cn" },
    });
    expect(zhLocaleResponse.status()).toBe(200);
    await gotoAndWaitForReady(page, "/signin");
    const passkeyButton = page.getByRole("button", {
      name: /使用通行密钥登录|Sign in with a passkey/i,
    });
    await expect(passkeyButton).toBeDisabled();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-cn");
    await expect(
      page.getByText("此浏览器或设备不支持通行密钥登录。"),
    ).toBeVisible();
    await captureStepScreenshot(
      page,
      testInfo,
      "settings-passkeys/unsupported-zh-cn",
    );

    const enLocaleResponse = await page.request.post("/api/locale", {
      data: { locale: "en-us" },
    });
    expect(enLocaleResponse.status()).toBe(200);
    await gotoAndWaitForReady(page, "/signin");
    await expect(page.locator("html")).toHaveAttribute("lang", "en-us");
    await expect(
      page.getByText(
        "Passkey sign-in is not supported by this browser or device.",
      ),
    ).toBeVisible();
    await captureStepScreenshot(
      page,
      testInfo,
      "settings-passkeys/unsupported-en-us",
    );
  });

  test("移动端通行密钥设置不产生横向溢出", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDebugUser(page, "/settings/accounts");

    const passkeyCard = page.locator("[data-passkey-settings]");
    await passkeyCard.scrollIntoViewIfNeeded();
    await expect(passkeyCard).toBeVisible();
    await expect(
      passkeyCard.getByLabel(/通行密钥名称|Passkey name/i),
    ).toBeVisible();
    await expect(
      passkeyCard.getByRole("button", {
        name: /添加通行密钥|Add passkey/i,
      }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await captureStepScreenshot(page, testInfo, "settings-passkeys/mobile");
  });

  test("取消通行密钥验证时保留登录页并显示可恢复错误", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.credentials, "get", {
        configurable: true,
        value: async () => {
          throw new DOMException("Cancelled by user", "NotAllowedError");
        },
      });
    });

    await gotoAndWaitForReady(page, "/signin");
    await page
      .getByRole("button", {
        name: /使用通行密钥登录|Sign in with a passkey/i,
      })
      .click();
    await expect(page).toHaveURL(/\/signin(?:\?.*)?$/);
    await expect(
      page.getByText(/验证已取消|verification was cancelled/i),
    ).toBeVisible();
  });

  test("服务端失败时保留登录页并显示通用错误", async ({ page }) => {
    await page.route(
      "**/api/auth/passkey/generate-authenticate-options",
      (route) =>
        route.fulfill({
          body: JSON.stringify({
            code: "INTERNAL_SERVER_ERROR",
            message: "Synthetic E2E failure",
          }),
          contentType: "application/json",
          status: 500,
        }),
    );

    await gotoAndWaitForReady(page, "/signin");
    await page
      .getByRole("button", {
        name: /使用通行密钥登录|Sign in with a passkey/i,
      })
      .click();
    await expect(page).toHaveURL(/\/signin(?:\?.*)?$/);
    await expect(
      page.getByText(/无法使用通行密钥登录|Unable to sign in with a passkey/i),
    ).toBeVisible();
  });

  test("注册会话过旧时提示用户重新登录", async ({ page }) => {
    await signInAsDebugUser(page, "/settings/accounts");
    await page.route(
      "**/api/auth/passkey/generate-register-options**",
      (route) =>
        route.fulfill({
          body: JSON.stringify({
            code: "SESSION_NOT_FRESH",
            message: "Synthetic stale session",
          }),
          contentType: "application/json",
          status: 401,
        }),
    );
    await gotoAndWaitForReady(page, "/settings/accounts");

    const passkeyCard = page.locator("[data-passkey-settings]");
    await passkeyCard
      .getByLabel(/通行密钥名称|Passkey name/i)
      .fill("Stale session key");
    await passkeyCard
      .getByRole("button", { name: /添加通行密钥|Add passkey/i })
      .click();
    await expect(
      passkeyCard.getByText(/先退出并重新登录|sign out and sign in again/i),
    ).toBeVisible();
  });

  test("设置列表失败时显示重试状态", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    await page.route("**/api/auth/passkey/list-user-passkeys", (route) =>
      route.fulfill({
        body: JSON.stringify({
          code: "INTERNAL_SERVER_ERROR",
          message: "Synthetic list failure",
        }),
        contentType: "application/json",
        status: 500,
      }),
    );
    await gotoAndWaitForReady(page, "/settings/accounts");

    const passkeyCard = page.locator("[data-passkey-settings]");
    await expect(
      passkeyCard.getByText(/无法加载通行密钥|Unable to load passkeys/i),
    ).toBeVisible();
    await expect(
      passkeyCard.getByRole("button", { name: /重试|Retry/i }),
    ).toBeVisible();
  });
});
