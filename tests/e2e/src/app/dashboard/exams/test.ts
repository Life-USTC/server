/**
 * E2E tests for the exams dashboard (`/workspace/exams`)
 *
 * ## Data Represented (exam.yml → cross-section-exam-list.display.fields)
 * - exam.examDate
 * - exam.startTime - endTime
 * - exam.examMode
 * - exam.examRooms[] (locations)
 * - section.course.namePrimary
 * - Filter: incomplete (upcoming) / completed (past) / all
 *
 * ## Features
 * - Exams flattened from subscribed sections, sorted by date then start time
 * - Desktop table / mobile cards link to /sections/{jwId}
 * - Completed vs incomplete: exam end time vs now
 *
 * ## Edge Cases
 * - Unauthenticated legacy tab → protected semantic route, then sign-in
 * - Exams without a date appear after dated exams
 * - Empty state when no subscriptions or no exams
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../utils/subscriptions";

test.describe("仪表盘考试", () => {
  test("未登录旧 exams tab 重定向到语义路径", async ({ page }) => {
    const response = await page.request.get("/?tab=exams&examView=list", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe("/workspace/exams?examView=list");
  });

  test("登录后显示考试筛选工具栏和列表", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/exams", {
      testInfo,
      screenshotLabel: "exams",
    });

    await expect(page.locator("#main-content")).toBeVisible();

    // Filter toolbar (exam.yml cross-section-exam-list.display.fields: completion filter)
    // In English locale: "Upcoming" / "Ended" / "All"
    const filterTabs = page.getByRole("group", { name: /考试|Exams/i });
    await expect(
      filterTabs.getByRole("radio", { name: /全部|All/i }),
    ).toBeVisible();
    // "Ended" in English, "已结束" or "已完成" in Chinese
    await expect(
      filterTabs.getByRole("radio", { name: /Ended|已结束|已完成/i }),
    ).toBeVisible();
    // Seed exams are in the past, so incomplete falls back to "all".
    await expect(
      filterTabs.getByRole("radio", { name: /全部|All/i }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      page
        .getByRole("table")
        .getByRole("row")
        .filter({
          has: page.locator('a[href^="/catalog/sections/"]'),
        })
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "exams/filter-empty-recovered");
  });

  test("移动端考试工具栏直接筛选并保持卡片视图", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.removeItem("life-ustc-dashboard-view-mode");
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await signInAsDebugUser(page, "/workspace/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/exams", {
      testInfo,
      screenshotLabel: "exams-mobile-toolbar",
    });

    const upcoming = page
      .getByRole("radio", {
        name: /Upcoming|未结束|即将|待完成/i,
      })
      .first();
    await expect(upcoming).toBeVisible();
    await expect(page.getByTestId("dashboard-exams-view-menu")).toHaveCount(0);

    for (const control of [upcoming]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }

    await gotoAndWaitForReady(page, "/workspace/exams?examView=list");
    const all = page
      .getByRole("group", { name: /考试|Exams/i })
      .getByRole("radio", { name: /全部|All/i });
    await all.click();
    await expect(all).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("dashboard-exams-cards")).toBeVisible();
    await expect(page.getByRole("table")).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await captureStepScreenshot(page, testInfo, "exams/mobile-toolbar");
  });

  test("考试列表显示必填字段", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/exams", {
      testInfo,
      screenshotLabel: "exams",
    });

    // Switch to "all" to see all exams regardless of completion
    const filterTabs = page.getByRole("group", { name: /考试|Exams/i });
    await filterTabs.getByRole("radio", { name: /全部|All/i }).click();
    await expect(
      filterTabs.getByRole("radio", { name: /全部|All/i }),
    ).toHaveAttribute("aria-checked", "true");

    const examRows = page
      .getByRole("table")
      .getByRole("row")
      .filter({
        has: page.locator('a[href^="/catalog/sections/"]'),
      });
    await expect(examRows.first()).toBeVisible({ timeout: 15_000 });

    const seedExamRow = examRows
      .filter({
        hasText: new RegExp(
          `${DEV_SEED.course.nameCn}|${DEV_SEED.course.nameEn}`,
        ),
      })
      .first();
    await expect(seedExamRow).toBeVisible();

    // section.course.namePrimary
    await expect(
      seedExamRow.locator('a[href^="/catalog/sections/"]').first(),
    ).toBeVisible();
    await expect(
      seedExamRow.locator('a[href^="/catalog/sections/"]').first(),
    ).toHaveText(/.+/);

    // exam.examDate — YYYY-MM-DD (or TBD)
    await expect(seedExamRow.getByRole("cell").nth(2)).toHaveText(/.+/);

    // exam.startTime - endTime — HH:mm-HH:mm format
    await expect(
      seedExamRow
        .getByRole("cell")
        .nth(3)
        .getByText(/\d{2}:\d{2}/),
    ).toBeVisible();

    // exam.examRooms[] — room name present
    const roomValue = seedExamRow.getByRole("cell").nth(4);
    await expect(roomValue).toHaveText(/\S/);
    await expect(roomValue).not.toHaveText(/TBD|待定|未定|—/i);

    await captureStepScreenshot(page, testInfo, "exams/list-fields");
  });

  test("考试列表链接到班级详情页", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/exams", {
      testInfo,
      screenshotLabel: "exams",
    });

    await page
      .getByRole("group", { name: /考试|Exams/i })
      .getByRole("radio", { name: /全部|All/i })
      .click();

    const sectionLink = page
      .getByRole("table")
      .locator('a[href^="/catalog/sections/"]')
      .first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();

    await expect(page).toHaveURL(/\/catalog\/sections\/\d+/);
    await captureStepScreenshot(page, testInfo, "exams/section-link");
  });

  test("已完成筛选显示过往考试，未完成显示即将到来", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/exams", {
      testInfo,
      screenshotLabel: "exams",
    });

    const filterTabs = page.getByRole("group", { name: /考试|Exams/i });

    // Switch to completed/ended filter
    const completedTab = filterTabs.getByRole("radio", {
      name: /Ended|已结束|已完成/i,
    });
    await completedTab.click();
    await expect(completedTab).toHaveAttribute("aria-checked", "true");
    const endedExamRows = page
      .getByRole("table")
      .getByRole("row")
      .filter({
        has: page.locator('a[href^="/catalog/sections/"]'),
      });
    await expect(endedExamRows.first()).toBeVisible({ timeout: 15_000 });
    await expect(
      endedExamRows.first().locator('a[href^="/catalog/sections/"]').first(),
    ).toHaveText(/.+/);
    await captureStepScreenshot(page, testInfo, "exams/filter-completed");

    // Switch back to incomplete/upcoming — falls back to "all" when empty.
    const incompleteTab = filterTabs.getByRole("radio", {
      name: /Upcoming|即将|即将考试|待完成|未结束/i,
    });
    await incompleteTab.click();
    const allTab = filterTabs.getByRole("radio", { name: /全部|All/i });
    await expect(allTab).toHaveAttribute("aria-checked", "true");
    await captureStepScreenshot(page, testInfo, "exams/filter-incomplete");
  });
});
