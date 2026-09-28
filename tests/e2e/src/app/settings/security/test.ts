import { expect } from "@playwright/test";
import { expectRequiresSignIn } from "../../../../utils/auth";

import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import {
  expectSettingsPage,
  storedProfile,
  test,
} from "../../../../utils/settings-fixture";

test.describe.configure({ mode: "parallel" });

test.describe("/account/settings/security 安全活动", () => {
  test("需要登录", async ({ page }) => {
    await expectRequiresSignIn(page, "/account/settings/security");
  });

  test("敏感活动分页展示且网络与设备信息脱敏", async ({
    page,
    account,
    isolatedWorker,
  }) => {
    await isolatedWorker.database.owner.auditLog.createMany({
      data: Array.from({ length: 31 }, (_, index) => ({
        action: "account_profile_update" as const,
        channel: "web" as const,
        outcome: "success" as const,
        userId: account.id,
        subjectUserId: account.id,
        ipAddress: index === 30 ? "198.51.100.7" : "203.0.113.42",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
      })),
    });
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
    const older = page.locator('a[href^="/account/settings/security?cursor="]');
    await expect(older).toBeVisible();
    await expect(region.getByText("198.51.100.*")).toBeVisible();
    await older.click();
    await expect(page).toHaveURL(/cursor=/);
    await expect(region.getByText("198.51.100.*")).toHaveCount(0);
    await expect(region.getByText("203.0.113.*").first()).toBeVisible();
    await expect(older).toHaveCount(0);
  });

  test("最近登录用户可以轮换私人日历链接", async ({
    page,
    account,
    isolatedWorker,
  }) => {
    const oldToken = crypto.randomUUID();
    await isolatedWorker.database.owner.user.update({
      where: { id: account.id },
      data: { calendarFeedToken: oldToken },
    });
    const oldFeed = `/api/calendar-feeds/${account.id}:${oldToken}.ics`;
    expect((await page.request.get(oldFeed)).status()).toBe(200);
    await gotoAndWaitForReady(page, "/account/settings/security");
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
    expect(
      await storedProfile(isolatedWorker.database.owner, account.id),
    ).toMatchObject({
      calendarFeedToken: oldToken,
    });

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
    const current = await storedProfile(
      isolatedWorker.database.owner,
      account.id,
    );
    expect(current?.calendarFeedToken).toEqual(expect.any(String));
    expect(current?.calendarFeedToken).not.toBe(oldToken);
    expect((await page.request.get(oldFeed)).status()).toBe(410);
    expect(
      (
        await page.request.get(
          `/api/calendar-feeds/${account.id}:${current?.calendarFeedToken}.ics`,
        )
      ).status(),
    ).toBe(200);
  });
});

test("页面契约", async ({ page, account: _account }, testInfo) => {
  await expectSettingsPage(page, "/account/settings/security", testInfo);
});
