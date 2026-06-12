/**
 * E2E tests for the Public User Profile by ID Page (`/u/id/[uid]`)
 *
 * ## Data Represented (user.yml → public-profile.display.fields)
 * - user.id (shown on ID route only)
 * - user.image (avatar)
 * - user.name (display name)
 * - user.username (@username)
 * - user.createdAt (join date)
 * - sectionCount, _count.comments, _count.uploads, _count.homeworksCreated
 * - weeks[].date / weeks[].count, totalContributions
 *
 * ## Rules
 * - user.id is shown on /u/id/[uid] (unlike /u/[username])
 *
 * ## Edge Cases
 * - Non-existent user ID → 404 page
 * - Requires sign-in to discover own ID via session API
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { getCurrentSessionUser } from "../../../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../../utils/screenshot";
import { assertPageContract } from "../../../_shared/page-contract";

test.describe("/u/id/[uid]", () => {
  test("contract", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/u/id/[uid]", testInfo });
  });

  test("displays all required profile fields including user ID", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/");
    const user = await getCurrentSessionUser(page);

    await gotoAndWaitForReady(page, `/u/id/${user.id}`);

    // user.name
    await expect(page.getByText(DEV_SEED.debugName).first()).toBeVisible();
    // user.username (@username)
    await expect(
      page.getByText(`@${DEV_SEED.debugUsername}`).first(),
    ).toBeVisible();
    // user.id (shown on ID route only — user.yml public-profile)
    await expect(page.getByText(user.id).first()).toBeVisible();
    // user.image (avatar)
    await expect(page.locator("img").first()).toBeVisible();
    // user.createdAt (join date)
    await expect(page.getByText(/加入时间|Joined/i).first()).toBeVisible();

    await captureStepScreenshot(page, testInfo, "u-id/profile-fields");
  });

  test("displays contribution heatmap and stat counters", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/");
    const user = await getCurrentSessionUser(page);
    const profileUrl = `/u/id/${user.id}`;
    const contributionCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: /贡献|Contribution/i })
      .last();

    await expect(async () => {
      await gotoAndWaitForReady(page, profileUrl);
      await expect(page).toHaveURL(new RegExp(`${profileUrl}$`));
      await expect(contributionCard).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 15_000,
      intervals: [500, 1_000],
    });

    // totalContributions label
    await expect(contributionCard).toBeVisible();
    // Stats grid
    const statsGrid = page
      .locator('[data-slot="card"]')
      .first()
      .locator("div.grid")
      .first();
    await expect(statsGrid).toBeVisible();

    await captureStepScreenshot(page, testInfo, "u-id/stats-and-heatmap");
  });

  test("returns 404 for non-existent user ID", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/u/id/non-existing-user-id", {
      expectMainContent: false,
    });
    await expect(page.getByText("404").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "u-id/404");
  });
});
