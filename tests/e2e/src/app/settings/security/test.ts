import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import {
  createAccountSecurityActivityFixture,
  deleteAccountSecurityActivityFixture,
  getCurrentSessionUser,
} from "../../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { assertPageContract } from "../../_shared/page-contract";

test.describe.configure({ mode: "serial" });

test.describe("/account/settings/security 安全活动", () => {
  test("需要登录", async ({ page }) => {
    await expectRequiresSignIn(page, "/account/settings/security");
  });

  test("敏感活动分页展示且网络与设备信息脱敏", async ({ page }) => {
    await signInAsDebugUser(page, "/account/settings/security");
    const user = await getCurrentSessionUser(page);
    const event = await createAccountSecurityActivityFixture(user.id);

    try {
      await gotoAndWaitForReady(page, "/account/settings/security");
      const region = page.getByRole("region", {
        name: /账户安全活动|Account security activity/i,
      });
      await expect(region).toBeVisible();
      await expect(
        region.getByText(/更新个人资料|Updated profile/i).first(),
      ).toBeVisible();
      await expect(region.getByText("203.0.113.*").first()).toBeVisible();
      await expect(region.getByText("Chrome · Windows").first()).toBeVisible();
      const text = await region.innerText();
      expect(text).not.toContain("203.0.113.42");
      expect(text).not.toContain("Chrome/130.0");
    } finally {
      await deleteAccountSecurityActivityFixture(event.id);
    }
  });

  test("最近登录用户可以轮换私人日历链接", async ({ page }) => {
    await signInAsDebugUser(page, "/account/settings/security");
    const rotate = page.getByRole("button", {
      name: /轮换私人日历链接|Rotate private calendar link/i,
    });
    await expect(rotate).toBeVisible();
    await rotate.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(
      /旧链接会立即失效|previous link stops working immediately/i,
    );
    await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
    await expect(dialog).not.toBeVisible();

    await rotate.click();
    await dialog
      .getByRole("button", {
        name: /确认轮换|Rotate link/i,
      })
      .click();
    await expect(page).toHaveURL(/\/account\/settings\/security$/);
    await expect(
      page
        .locator("[data-sonner-toast]")
        .filter({ hasText: /日历链接已轮换|Calendar link rotated/i }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", {
          name: /账户安全活动|Account security activity/i,
        })
        .getByText(/轮换日历令牌|Rotated calendar token/i)
        .first(),
    ).toBeVisible();
  });
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, {
    routePath: "/account/settings/security",
    testInfo,
  });
});
