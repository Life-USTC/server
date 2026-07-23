/**
 * E2E tests for the unified Public User Profile Page (`/community/users/[identifier]`)
 *
 * ## Data Represented (user.yml → public-profile.display.fields)
 * - user.image (avatar)
 * - user.name (display name)
 * - user.username (@username)
 * - user.createdAt (join date)
 * - sectionCount, _count.comments, _count.uploads, _count.homeworksCreated
 * - weeks[].date / weeks[].count, totalContributions
 *
 * ## Rules
 * - The same route accepts either a username or user ID
 * - Raw internal user IDs are not rendered as public profile metadata
 *
 * ## Edge Cases
 * - Non-existent user ID → 404 page
 * - Requires sign-in to discover own ID via session API
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import {
  getCurrentSessionUser,
  getUserProfileById,
  updateUserProfileById,
} from "../../../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../../utils/screenshot";
import { assertPageContract } from "../../../_shared/page-contract";

test.describe.configure({ mode: "serial" });

test.describe("/community/users/[identifier] by ID", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/community/users/[identifier]",
      testInfo,
    });
  });

  test("ID 地址直接解析资料且不显示内部 ID", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/");
    const user = await getCurrentSessionUser(page);

    const response = await page.request.get(`/community/users/${user.id}`);
    expect(response.status()).toBe(200);
    await gotoAndWaitForReady(page, `/community/users/${user.id}`);
    await expect(page).toHaveURL(new RegExp(`/community/users/${user.id}$`));

    await expect(page.getByText(DEV_SEED.debugName).first()).toBeVisible();
    await expect(
      page.getByText(`@${DEV_SEED.debugUsername}`).first(),
    ).toBeVisible();
    await expect(page.getByText(user.id, { exact: true })).toHaveCount(0);
    await expect(page.locator("img").first()).toBeVisible();
    await expect(page.getByText(/加入时间|Joined/i).first()).toBeVisible();

    await captureStepScreenshot(page, testInfo, "u-id/canonical-profile");
  });

  test("无用户名资料保留 ID 地址但不渲染 raw ID", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/");
    const user = await getCurrentSessionUser(page);
    const originalProfile = await getUserProfileById(user.id);

    try {
      await updateUserProfileById(user.id, { username: null });
      await page.context().clearCookies();
      const response = await page.request.get(`/community/users/${user.id}`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);

      await gotoAndWaitForReady(page, `/community/users/${user.id}`);
      await expect(page).toHaveURL(new RegExp(`/community/users/${user.id}$`));
      await expect(page.getByText(DEV_SEED.debugName).first()).toBeVisible();
      await expect(page.getByText(user.id, { exact: true })).toHaveCount(0);
      await captureStepScreenshot(page, testInfo, "u-id/no-username");
    } finally {
      await updateUserProfileById(user.id, {
        name: originalProfile.name,
        username: originalProfile.username ?? DEV_SEED.debugUsername,
        image: originalProfile.image,
      });
    }
  });

  test("贡献热力图在移动端可滚动并支持键盘和触摸选择", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(
      page,
      `/community/users/${DEV_SEED.debugUsername}`,
    );

    const scrollRegion = page.locator("[data-profile-heatmap-scroll]");
    const cells = page.locator("[data-profile-contribution-cell]");
    await expect(scrollRegion).toBeVisible();
    expect(await cells.count()).toBeGreaterThan(350);
    const overflow = await scrollRegion.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    expect(overflow).toBe(true);

    const firstCell = cells.first();
    const firstLabel = await firstCell.getAttribute("aria-label");
    const mobileCellBox = await firstCell.boundingBox();
    expect(mobileCellBox?.width).toBeGreaterThanOrEqual(20);
    await firstCell.click();
    await expect(page.locator("[data-profile-contribution-detail]")).toHaveText(
      firstLabel ?? "",
    );

    const lastCell = cells.last();
    const lastLabel = await lastCell.getAttribute("aria-label");
    await lastCell.focus();
    await expect(lastCell).toBeFocused();
    await expect(page.locator("[data-profile-contribution-detail]")).toHaveText(
      lastLabel ?? "",
    );
    await captureStepScreenshot(page, testInfo, "u-profile/heatmap-mobile");

    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAndWaitForReady(
      page,
      `/community/users/${DEV_SEED.debugUsername}`,
    );
    const desktopCellBox = await cells.first().boundingBox();
    expect(desktopCellBox?.width).toBeGreaterThanOrEqual(15);
    await captureStepScreenshot(page, testInfo, "u-profile/heatmap-desktop");
  });

  test("不存在的用户 ID 返回 404", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/community/users/non-existing-user-id", {
      expectMainContent: false,
    });
    await expect(page.getByText("404").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "u-id/404");
  });
});
