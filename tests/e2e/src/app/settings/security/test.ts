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
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, {
    routePath: "/account/settings/security",
    testInfo,
  });
});
