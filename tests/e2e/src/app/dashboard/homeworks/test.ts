/**
 * E2E tests for the homeworks dashboard (`/dashboard/homeworks`)
 *
 * ## Data Represented (homework.yml → cross-section-homework-summary.display.fields)
 * - homework.title
 * - homework.description.content
 * - homework.submissionDueAt (with ETA label)
 * - section.course.namePrimary
 * - homework.isMajor badge
 * - homework.requiresTeam badge
 * - completionStatus (completed/pending)
 * - filter: incomplete / completed / all
 *
 * ## Features
 * - Hover card to reveal completion button
 * - "View details" link → /sections/{jwId}#homework-{id}
 * - Create homework button → modal form
 *
 * ## Edge Cases
 * - Unauthenticated → public links view (homeworks tab auth-only)
 * - Completion toggle calls PUT /api/homeworks/{id}/completion
 * - Empty state when filter yields no results
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../utils/subscriptions";

test.describe("dashboard homeworks", () => {
  test.describe.configure({ mode: "serial" });

  test("unauthenticated ?tab=homeworks falls back to public view", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await expect(page).toHaveURL(/\/\?tab=homeworks$/);
    await expect(page.locator("#main-content")).toBeVisible();

    // Public view: sign-in CTA visible, no auth-only tabs
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /^(网站|Websites)$/i }),
    ).toBeVisible();
    // Homeworks tab NOT in public nav
    await expect(
      page.getByRole("tab", { name: /^(作业|Homework)$/i }),
    ).toHaveCount(0);

    await captureStepScreenshot(page, testInfo, "homeworks/unauthenticated");
  });

  test("authenticated shows seed homework with all required fields", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    // Switch to All to see all homeworks
    await page
      .getByRole("tab", { name: /全部|All/i })
      .first()
      .click();

    const hwCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(hwCard).toBeVisible();

    // homework.title
    await expect(hwCard.getByText(DEV_SEED.homeworks.title)).toBeVisible();
    await expect(hwCard.getByText(/\d{1,2}:\d{2}/).first()).toBeVisible();

    // section.course.namePrimary appears in the homework subtitle.
    await expect(
      hwCard
        .getByText(DEV_SEED.course.nameCn)
        .or(hwCard.getByText(DEV_SEED.course.nameEn))
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "homeworks/seed-card-fields");
  });

  test("seeded collaborative homework shows major and team badges", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("tab", { name: /全部|All/i })
      .first()
      .click();

    const hwCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(hwCard).toBeVisible();
    await expect(hwCard.getByText(/重要|Major|重大/i)).toBeVisible();
    await expect(hwCard.getByText(/团队|Team/i)).toBeVisible();

    await captureStepScreenshot(page, testInfo, "homeworks/major-team-badges");
  });

  test("can switch between filter tabs", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });
    await expect(page.getByText(DEV_SEED.homeworks.overdueTitle)).toBeVisible();

    // Completed filter
    const completedTab = page
      .getByRole("tab", { name: /已完成|Completed/i })
      .first();
    await expect(completedTab).toBeVisible();
    await completedTab.click();
    await expect(
      page.getByText(DEV_SEED.homeworks.completedTitle),
    ).toBeVisible();
    await expect(page.getByText(DEV_SEED.homeworks.overdueTitle)).toHaveCount(
      0,
    );
    await captureStepScreenshot(page, testInfo, "homeworks/filter-completed");

    // All filter
    const allTab = page.getByRole("tab", { name: /全部|All/i }).first();
    await expect(allTab).toBeVisible();
    await allTab.click();
    await expect(page.getByText(DEV_SEED.homeworks.overdueTitle)).toBeVisible();
    await captureStepScreenshot(page, testInfo, "homeworks/filter-all");
  });

  test("can switch to list view and persist preference", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("tab", { name: /全部|All/i })
      .first()
      .click();

    await expect(page.getByTestId("dashboard-homeworks-cards")).toBeVisible();
    await page.getByRole("tab", { name: /列表|List/i }).click();
    await expect(page).toHaveURL(/homeworkView=list/);
    await expect(page.getByTestId("dashboard-homeworks-list")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("life-ustc-dashboard-view-mode"),
        ),
      )
      .toBe("list");

    await gotoAndWaitForReady(page, "/dashboard/homeworks");
    await page
      .getByRole("tab", { name: /全部|All/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/dashboard\/homeworks$/);
    await expect(page.getByTestId("dashboard-homeworks-list")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "homeworks/list-view");
  });

  test("can toggle homework completion status", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    // Switch to "all" filter
    await page
      .getByRole("tab", { name: /全部|All/i })
      .first()
      .click();

    await expect(page.getByRole("switch")).toHaveCount(0);

    const card = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(card).toBeVisible();
    await card.hover();

    const completionButton = card
      .getByRole("button", {
        name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
      })
      .first();
    await expect(completionButton).toHaveCSS("opacity", "1");

    const before = (await completionButton.textContent())?.trim() ?? "";

    const completionResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/homeworks/") &&
        r.url().includes("/completion") &&
        r.status() === 200,
    );
    await completionButton.click();
    await completionResponse;
    await expect(completionButton).not.toHaveText(before, { timeout: 15_000 });

    const after = (await completionButton.textContent())?.trim() ?? "";
    expect(after).not.toBe(before);
    await captureStepScreenshot(page, testInfo, "homeworks/completion-toggled");

    // Restore
    const restoreResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/homeworks/") &&
        r.url().includes("/completion") &&
        r.status() === 200,
    );
    await completionButton.click();
    await restoreResponse;
  });

  test("view details links to section page with homework anchor", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("tab", { name: /全部|All/i })
      .first()
      .click();

    const detailLink = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await detailLink
      .getByRole("button", { name: new RegExp(DEV_SEED.homeworks.title) })
      .first()
      .click();
    const popout = page.locator('[data-slot="dialog-popup"]').first();
    await expect(popout).toBeVisible();
    const sectionLink = popout
      .locator(`a[href*="/sections/${DEV_SEED.section.jwId}#homework-"]`)
      .first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();

    await expect(page).toHaveURL(/\/sections\/\d+#homework-/);
    await captureStepScreenshot(page, testInfo, "homeworks/view-details");
  });

  test("can create a new homework", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    const addButton = page.getByTestId("dashboard-homeworks-add").first();
    const title = `e2e-dashboard-homework-${Date.now()}`;
    const titleInput = page.getByTestId("dashboard-homework-title");
    await expect(async () => {
      await expect(addButton).toBeVisible({ timeout: 3_000 });
      await addButton.click();
      await expect(titleInput).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });
    await titleInput.fill(title);
    await page.getByTestId("dashboard-homework-create").click();

    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });
    await captureStepScreenshot(page, testInfo, "homeworks/created");
  });
});
