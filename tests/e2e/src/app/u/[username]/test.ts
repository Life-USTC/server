/**
 * E2E tests for the Public User Profile Page (`/community/users/[username]` and `/community/users/id/[uid]`)
 *
 * ## Data Represented (user.yml → public-profile.display.fields)
 * - user.image (avatar)
 * - user.name (display name)
 * - user.username (@username)
 * - user.createdAt (join date)
 * - sectionCount (subscribed sections)
 * - user._count.comments (total comments)
 * - user._count.uploads (total uploads)
 * - user._count.homeworksCreated (homeworks created)
 * - weeks[].date (YYYY-MM-DD) / weeks[].count (contribution counts)
 * - totalContributions (aggregate)
 *
 * ## Rules
 * - Raw internal user IDs are not shown on public profiles
 * - ID routes redirect to /u/[username] when a username exists
 * - Public page: no auth required
 *
 * ## Edge Cases
 * - Non-existent username → 404 page with "Home" link
 * - Empty username param → 404
 */
import { expect, test } from "@playwright/test";
import { signInAsDevAdmin } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { absoluteTestUrl } from "../../../../utils/request-url";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

test.describe("/community/users/[username]", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/community/users/[username]",
      testInfo,
    });
  });

  test("显示所有必需的资料字段", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(
      page,
      `/community/users/${DEV_SEED.adminUsername}`,
    );

    // user.name (display name)
    await expect(page.getByText(DEV_SEED.adminName).first()).toBeVisible();
    // user.username (@username)
    await expect(
      page.getByText(`@${DEV_SEED.adminUsername}`).first(),
    ).toBeVisible();

    // user.image (avatar) — img element should be present
    await expect(page.locator("img").first()).toBeVisible();

    // user.createdAt — join date label present
    await expect(
      page.getByText(/加入时间|Joined|joined/i).first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "u-username/profile-fields");
  });

  test("显示统计计数器网格", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(
      page,
      `/community/users/${DEV_SEED.adminUsername}`,
    );

    // sectionCount, _count.comments, _count.uploads, _count.homeworksCreated
    // Stats grid must contain numeric counters
    const statsGrid = page.locator("[class*=grid]").filter({
      has: page.locator("[class*=text]"),
    });
    await expect(statsGrid.first()).toBeVisible();

    // At least one numeric counter is present (even if 0)
    const counters = page.locator(
      "[class*=stat], [class*=count], [class*=grid] [class*=text]",
    );
    expect(await counters.count()).toBeGreaterThan(0);

    await captureStepScreenshot(page, testInfo, "u-username/stats-grid");
  });

  test("显示贡献热力图及 totalContributions", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(
      page,
      `/community/users/${DEV_SEED.debugUsername}`,
    );

    // totalContributions label or heading
    await expect(page.getByText(/贡献|contribution/i).first()).toBeVisible();

    const heatmapCells = page.locator("[data-profile-contribution-cell]");
    expect(await heatmapCells.count()).toBeGreaterThan(350);
    await expect(heatmapCells.first()).toBeVisible();

    await captureStepScreenshot(
      page,
      testInfo,
      "u-username/contribution-heatmap",
    );
  });

  test("用户名页面不显示内部用户 ID", async ({ baseURL }) => {
    // user.yml: public-identity-display rule — internal ids hidden (permission.yml)
    const res = await fetch(
      absoluteTestUrl(`/community/users/${DEV_SEED.adminUsername}`, baseURL),
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    // Internal cuid IDs (26 chars) should not appear in visible page content
    // We check that the URL pattern /u/id/ is not linked from this page
    expect(html).not.toMatch(/\/u\/id\/[a-z0-9]{15,}/);
  });

  test("不存在的用户名返回 404", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/community/users/non-existing-username", {
      expectMainContent: false,
    });
    await expect(page.getByText("404").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /返回首页|Home/i }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "u-username/404");
  });
});

test.describe("/community/users/id/[uid]", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/community/users/id/[uid]",
      testInfo,
    });
  });

  test("内部用户 ID 地址重定向到用户名资料页", async ({ page }, testInfo) => {
    await signInAsDevAdmin(page, "/");
    const sessionResponse = await page.request.get("/api/auth/get-session");
    expect(sessionResponse.status()).toBe(200);
    const session = (await sessionResponse.json()) as {
      user?: { id?: string };
    };
    expect(session.user?.id).toBeTruthy();

    await gotoAndWaitForReady(page, `/community/users/id/${session.user?.id}`);
    await expect(page).toHaveURL(
      new RegExp(`/community/users/${DEV_SEED.adminUsername}$`),
    );
    await expect(
      page.getByText(`@${DEV_SEED.adminUsername}`).first(),
    ).toBeVisible();
    await expect(page.getByText(DEV_SEED.adminName).first()).toBeVisible();

    await captureStepScreenshot(page, testInfo, "u-id/profile");
  });

  test("不存在的 uid 返回 404", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(
      page,
      "/community/users/id/non-existent-uid-000000000",
      {
        expectMainContent: false,
      },
    );
    await expect(page.getByText("404").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "u-id/404");
  });
});
