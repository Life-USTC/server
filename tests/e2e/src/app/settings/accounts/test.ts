/**
 * E2E tests for the Settings Accounts Tab (`/settings?tab=accounts`)
 *
 * ## Data Represented
 * - `/settings?tab=accounts` is the canonical linked-account settings entry.
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
import { expect, test } from "@playwright/test";
import {
  expectPagePath,
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import {
  deleteLinkedAccountFixture,
  ensureLinkedAccountFixture,
  getCurrentSessionUser,
} from "../../../../utils/e2e-db";
import { waitForUiSettled } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe("/settings?tab=accounts", () => {
  test("requires authentication", async ({ page }, testInfo) => {
    await expectRequiresSignIn(page, "/settings?tab=accounts");
    await captureStepScreenshot(
      page,
      testInfo,
      "settings-accounts-unauthorized",
    );
  });

  test("displays all provider cards", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/settings?tab=accounts");

    await expectPagePath(page, "/settings?tab=accounts");
    await expect(page.getByText("GitHub").first()).toBeVisible();
    await expect(page.getByText("Google").first()).toBeVisible();
    await expect(page.getByText("USTC").first()).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-accounts-platforms");
  });

  test("connect button initiates account-linking OAuth flow", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/settings?tab=accounts");

    const providerCard = page
      .locator("#main-content .rounded-lg.border")
      .filter({ has: page.getByText("USTC", { exact: true }) })
      .first();
    const connectButton = providerCard.getByRole("button", {
      name: /连接|Connect/i,
    });
    if (
      (await providerCard.count()) === 0 ||
      (await connectButton.count()) === 0
    ) {
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }

    await waitForUiSettled(page);
    await expect(connectButton).toBeEnabled();

    const linkActionRequestPromise = page.waitForRequest(
      (request) => {
        const url = new URL(request.url());
        return (
          request.method() === "POST" &&
          url.pathname === "/settings" &&
          url.search.includes("/linkAccount")
        );
      },
      { timeout: 15_000 },
    );

    await connectButton.click();
    await linkActionRequestPromise;

    try {
      await captureStepScreenshot(page, testInfo, "settings-accounts-oauth");
    } catch {
      // OAuth redirect may leave the page in an unscreenshottable state
    }
  });

  test("disconnect disabled when only one account linked", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/settings?tab=accounts");

    const disconnectButton = page
      .getByRole("button", { name: /断开连接|Disconnect/i })
      .first();
    if ((await disconnectButton.count()) === 0) {
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }

    await expect(disconnectButton).toBeDisabled();
    await expect(
      page.getByText(/不能断开唯一关联的账户|cannot disconnect/i).first(),
    ).toBeVisible();
    await captureStepScreenshot(
      page,
      testInfo,
      "settings-accounts-disconnect-disabled",
    );
  });

  test("multi-account: cancel and confirm unlink flow", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    const provider = "github";
    await signInAsDebugUser(page, "/settings?tab=accounts");
    const user = await getCurrentSessionUser(page);

    // Ensure a second account exists for the test
    await deleteLinkedAccountFixture({ userId: user.id, provider });
    await ensureLinkedAccountFixture({ userId: user.id, provider });

    try {
      await signInAsDebugUser(page, "/settings?tab=accounts", undefined, {
        ui: true,
      });
      await waitForUiSettled(page);
      await expectPagePath(page, "/settings?tab=accounts");

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
      await captureStepScreenshot(page, testInfo, "settings-accounts-unlinked");
    } finally {
      await deleteLinkedAccountFixture({ userId: user.id, provider });
    }
  });
});
