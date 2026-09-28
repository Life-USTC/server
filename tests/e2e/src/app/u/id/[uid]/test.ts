/**
 * E2E tests for the unified Public User Profile Page (`/community/users/[identifier]`)
 *
 * ## Data Represented (user.yml → public-profile.display.fields)
 * - user.image (avatar)
 * - user.name (display name)
 * - user.username (@username)
 * - user.createdAt (join date)
 * - _count.comments, _count.uploads, _count.homeworksCreated
 * - weeks[].date / weeks[].count, totalContributions
 *
 * ## Rules
 * - The same route accepts either a username or user ID
 * - Raw internal user IDs are not rendered as public profile metadata
 *
 * ## Edge Cases
 * - Non-existent user ID → 404 page
 * - Missing username must not expose the internal ID as public metadata
 */
import { expect } from "@playwright/test";
import { updateUserProfileById } from "../../../../../utils/e2e-db";
import { test } from "../../../../../utils/isolated-account";
import { gotoAndWaitForReady } from "../../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../../utils/screenshot";

test.describe("/community/users/[identifier] by ID", () => {
  test("页面契约", async ({ page, account }, testInfo) => {
    await page.context().clearCookies();
    const response = await gotoAndWaitForReady(
      page,
      `/community/users/${account.username}`,
      {
        browserHealth: {},
        expectMeaningfulContent: true,
        expectNoHorizontalOverflow: true,
        uiQuality: {},
        testInfo,
      },
    );
    expect(response?.status()).toBe(200);
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: account.name }),
    ).toBeVisible();
    await expect(
      page.getByText(`@${account.username}`, { exact: true }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "u-username");
  });

  test("ID 地址直接解析资料且不显示内部 ID", async ({
    page,
    account,
  }, testInfo) => {
    await updateUserProfileById(account.id, { image: "/images/icon.png" });

    const response = await page.request.get(`/community/users/${account.id}`);
    expect(response.status()).toBe(200);
    await gotoAndWaitForReady(page, `/community/users/${account.id}`);
    await expect(page).toHaveURL(new RegExp(`/community/users/${account.id}$`));

    await expect(page.getByText(account.name).first()).toBeVisible();
    await expect(page.getByText(`@${account.username}`).first()).toBeVisible();
    await expect(page.getByText(account.id, { exact: true })).toHaveCount(0);
    await expect(
      page
        .locator("#main-content")
        .getByRole("img", { name: account.name, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/加入时间|Joined/i).first()).toBeVisible();

    await captureStepScreenshot(page, testInfo, "u-id/canonical-profile");
  });

  test("无用户名资料保留 ID 地址但不渲染 raw ID", async ({
    page,
    account,
  }, testInfo) => {
    await updateUserProfileById(account.id, { username: null });
    await page.context().clearCookies();
    const response = await page.request.get(`/community/users/${account.id}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);

    await gotoAndWaitForReady(page, `/community/users/${account.id}`);
    await expect(page).toHaveURL(new RegExp(`/community/users/${account.id}$`));
    await expect(page.getByText(account.name).first()).toBeVisible();
    await expect(page.getByText(account.id, { exact: true })).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "u-id/no-username");
  });

  test("贡献热力图在移动端可滚动并支持键盘和触摸选择", async ({
    page,
    account,
  }, testInfo) => {
    await page.context().clearCookies();
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, `/community/users/${account.username}`);

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
    expect(
      await cells.evaluateAll(
        (elements) =>
          elements.filter((element) => element.getAttribute("tabindex") === "0")
            .length,
      ),
    ).toBe(1);
    await firstCell.focus();
    await firstCell.press("ArrowRight");
    await expect(cells.nth(1)).toBeFocused();
    const columnCount = Number(
      await page
        .locator("[data-profile-contribution-grid]")
        .getAttribute("aria-colcount"),
    );
    await cells.nth(1).press("ArrowDown");
    await expect(cells.nth(columnCount + 1)).toBeFocused();
    await cells.nth(columnCount + 1).press("Home");
    await expect(cells.nth(columnCount)).toBeFocused();
    await cells.nth(columnCount).press("End");
    await expect(cells.nth(columnCount * 2 - 1)).toBeFocused();
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
    await gotoAndWaitForReady(page, `/community/users/${account.username}`);
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
