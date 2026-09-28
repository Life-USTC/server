import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { test } from "../../../../utils/settings-fixture";

test.describe("/account/settings/accounts 通行密钥", () => {
  test.describe.configure({ mode: "parallel" });

  test("user.passkey-user-flow", async ({
    page,
    account,
    credential: _credential,
    isolatedWorker,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 1000 });
    // Successful deletion requires another usable sign-in method.
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
      await gotoAndWaitForReady(page, "/account/settings/accounts");
      const passkeyCard = page.locator("[data-passkey-settings]");
      await expect(passkeyCard).toBeVisible();

      await passkeyCard
        .getByLabel(/通行密钥名称|Passkey name/i)
        .fill("E2E laptop");
      await passkeyCard
        .getByRole("button", { name: /添加通行密钥|Add passkey/i })
        .click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /通行密钥已添加|Passkey added/i }),
      ).toBeVisible();
      await expect(
        passkeyCard.getByLabel(/重命名 E2E laptop|Rename E2E laptop/i),
      ).toHaveValue("E2E laptop");
      const credentials = await cdp.send("WebAuthn.getCredentials", {
        authenticatorId,
      });
      expect(credentials.credentials).toHaveLength(1);
      const stored = await isolatedWorker.database.owner.passkey.findMany({
        where: { userId: account.id },
      });
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        userId: account.id,
        name: "E2E laptop",
      });
      expect(stored[0].credentialID).not.toBe("");
      expect(stored[0].publicKey).not.toBe("");
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
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /通行密钥名称已更新|Passkey name updated/i }),
      ).toBeVisible();
      await expect(
        passkeyCard.getByLabel(
          /重命名 E2E security key|Rename E2E security key/i,
        ),
      ).toHaveValue("E2E security key");

      expect(
        await isolatedWorker.database.owner.passkey.findUnique({
          where: { id: stored[0].id },
        }),
      ).toMatchObject({ name: "E2E security key", userId: account.id });
      await page.locator("#app-user-menu").getByRole("button").click();
      await page.getByRole("menuitem", { name: /登出|Sign Out/i }).click();
      await expect(page).toHaveURL(/\/(?:\?.*)?$/);

      await gotoAndWaitForReady(
        page,
        "/account/sign-in?callbackUrl=%2Faccount%2Fsettings%2Faccounts",
      );
      await page
        .getByRole("button", {
          name: /使用通行密钥登录|Sign in with a passkey/i,
        })
        .click();
      await expect(page).toHaveURL(/\/account\/settings\/accounts(?:\?.*)?$/);
      await expect(
        page
          .locator("[data-passkey-settings]")
          .getByLabel(/重命名 E2E security key|Rename E2E security key/i),
      ).toHaveValue("E2E security key");
      const session = await page.request.get("/api/auth/get-session");
      expect(session.status()).toBe(200);
      expect((await session.json()).user.id).toBe(account.id);
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
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /通行密钥已删除|Passkey deleted/i }),
      ).toBeVisible();
      expect(
        await isolatedWorker.database.owner.passkey.findMany({
          where: { userId: account.id },
        }),
      ).toEqual([]);
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
  });

  test("user.passkey-unsupported", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "PublicKeyCredential", {
        configurable: true,
        value: undefined,
      });
    });

    const zhLocaleResponse = await page.request.post(
      "/api/account/preferences",
      {
        data: { locale: "zh-cn" },
      },
    );
    expect(zhLocaleResponse.status()).toBe(200);
    await gotoAndWaitForReady(page, "/account/sign-in");
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

    const enLocaleResponse = await page.request.post(
      "/api/account/preferences",
      {
        data: { locale: "en-us" },
      },
    );
    expect(enLocaleResponse.status()).toBe(200);
    await gotoAndWaitForReady(page, "/account/sign-in");
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

  test("user.passkey-mobile-controls", async ({
    page,
    account: _account,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/account/settings/accounts");

    const passkeyCard = page.locator("[data-passkey-settings]");
    await passkeyCard.scrollIntoViewIfNeeded();
    await expect(passkeyCard).toBeVisible();
    await expect(
      passkeyCard.getByLabel(/通行密钥名称|Passkey name/i),
    ).toBeVisible();
    const addPasskeyButton = passkeyCard.getByRole("button", {
      name: /添加通行密钥|Add passkey/i,
    });
    await expect(addPasskeyButton).toBeVisible();
    const addPasskeyBox = await addPasskeyButton.boundingBox();
    expect(addPasskeyBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(addPasskeyBox?.height ?? 0).toBeGreaterThanOrEqual(44);
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

  test("user.passkey-cancelled", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.credentials, "get", {
        configurable: true,
        value: async () => {
          throw new DOMException("Cancelled by user", "NotAllowedError");
        },
      });
    });

    await gotoAndWaitForReady(page, "/account/sign-in");
    await page
      .getByRole("button", {
        name: /使用通行密钥登录|Sign in with a passkey/i,
      })
      .click();
    await expect(page).toHaveURL(/\/account\/sign-in(?:\?.*)?$/);
    await expect(
      page.getByText(/验证已取消|verification was cancelled/i),
    ).toBeVisible();
  });

  test("user.passkey-sign-in-failure", async ({ page }) => {
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

    await gotoAndWaitForReady(page, "/account/sign-in");
    await page
      .getByRole("button", {
        name: /使用通行密钥登录|Sign in with a passkey/i,
      })
      .click();
    await expect(page).toHaveURL(/\/account\/sign-in(?:\?.*)?$/);
    await expect(
      page.getByText(/无法使用通行密钥登录|Unable to sign in with a passkey/i),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "Synthetic E2E failure",
    );
  });

  test("user.passkey-stale-session-guidance", async ({
    page,
    account,
    isolatedWorker,
  }) => {
    await gotoAndWaitForReady(page, "/account/settings/accounts");
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
    await gotoAndWaitForReady(page, "/account/settings/accounts");

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
    expect(
      await isolatedWorker.database.owner.passkey.count({
        where: { userId: account.id },
      }),
    ).toBe(0);
  });

  test("user.passkey-list-retry", async ({ page, account: _account }) => {
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
    await gotoAndWaitForReady(page, "/account/settings/accounts");

    const passkeyCard = page.locator("[data-passkey-settings]");
    await expect(
      passkeyCard.getByText(/无法加载通行密钥|Unable to load passkeys/i),
    ).toBeVisible();
    await expect(
      passkeyCard.getByRole("button", { name: /重试|Retry/i }),
    ).toBeVisible();
    await page.unroute("**/api/auth/passkey/list-user-passkeys");
    const reloaded = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        "/api/auth/passkey/list-user-passkeys",
    );
    await passkeyCard.getByRole("button", { name: /重试|Retry/i }).click();
    expect((await reloaded).status()).toBe(200);
    await expect(
      passkeyCard.getByText(/无法加载通行密钥|Unable to load passkeys/i),
    ).toHaveCount(0);
    await expect(
      passkeyCard.getByText(/尚未添加通行密钥|No passkeys yet/i),
    ).toBeVisible();
  });
});
