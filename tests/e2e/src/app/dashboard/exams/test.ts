/**
 * E2E tests for the exams dashboard (`/dashboard/exams`)
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
 * - Cards link to /sections/{jwId}
 * - Completed vs incomplete: exam end time vs now
 *
 * ## Edge Cases
 * - Unauthenticated → public links view (no exams tab)
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
  test("未登录 ?tab=exams 显示公共视图（无考试标签）", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=exams", {
      testInfo,
      screenshotLabel: "exams",
    });

    await expect(page).toHaveURL(/\/\?tab=exams$/);
    await expect(page.locator("#main-content")).toBeVisible();

    // Public view: sign-in CTA, no auth-only tabs
    await expect(
      page.getByRole("link", { name: /^(网站|Websites)$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
    ).toBeVisible();
    // Exams tab should NOT appear in public nav
    await expect(
      page.getByRole("link", { name: /^(考试|Exams)$/i }),
    ).toHaveCount(0);

    await captureStepScreenshot(page, testInfo, "exams/unauthenticated");
  });

  test("登录后显示考试筛选工具栏和卡片", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/exams", {
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
    await expect(
      filterTabs.getByRole("radio", {
        name: /Upcoming|即将|即将考试|待完成/i,
      }),
    ).toHaveAttribute("aria-checked", "true");

    await captureStepScreenshot(page, testInfo, "exams/filter-toolbar");
  });

  test("移动端考试工具栏直接筛选并通过菜单切换视图", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.removeItem("life-ustc-dashboard-view-mode");
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await signInAsDebugUser(page, "/dashboard/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/exams", {
      testInfo,
      screenshotLabel: "exams-mobile-toolbar",
    });

    const upcoming = page
      .getByRole("radio", {
        name: /Upcoming|未结束|即将|待完成/i,
      })
      .first();
    const viewMenu = page.getByTestId("dashboard-exams-view-menu");
    await expect(upcoming).toBeVisible();
    await expect(viewMenu).toBeVisible();

    for (const control of [upcoming, viewMenu]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }

    const all = page
      .getByRole("group", { name: /考试|Exams/i })
      .getByRole("radio", { name: /全部|All/i });
    await all.click();
    await expect(all).toHaveAttribute("aria-checked", "true");
    await viewMenu.click();
    await page.getByRole("menuitemradio", { name: /列表|List/i }).click();
    await expect(page).toHaveURL(/examView=list/);
    await expect(page.getByRole("table")).toBeVisible();
    await expect(all).toHaveAttribute("aria-checked", "true");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await captureStepScreenshot(page, testInfo, "exams/mobile-toolbar");
  });

  test("考试卡片显示必填字段", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/exams", {
      testInfo,
      screenshotLabel: "exams",
    });

    // Switch to "all" to see all exams regardless of completion
    const filterTabs = page.getByRole("group", { name: /考试|Exams/i });
    await filterTabs.getByRole("radio", { name: /全部|All/i }).click();
    await expect(
      filterTabs.getByRole("radio", { name: /全部|All/i }),
    ).toHaveAttribute("aria-checked", "true");

    // exam cards should be visible
    const examCards = page.locator('[data-slot="card"]').filter({
      has: page.locator('a[href^="/sections/"]'),
    });
    await expect(examCards.first()).toBeVisible({ timeout: 15_000 });

    const seedExamCard = examCards
      .filter({
        hasText: new RegExp(
          `${DEV_SEED.examBatch.nameCn}|${DEV_SEED.examBatch.nameEn}`,
        ),
      })
      .first();
    const firstCard = seedExamCard;
    await expect(firstCard).toBeVisible();

    // section.course.namePrimary (exam.yml cross-section-exam-list.display.fields)
    await expect(
      firstCard.locator('a[href^="/sections/"]').first(),
    ).toBeVisible();
    await expect(firstCard.locator('a[href^="/sections/"]').first()).toHaveText(
      /.+/,
    );

    // exam.examDate — YYYY-MM-DD format visible
    await expect(
      firstCard.getByText(/\d{4}-\d{2}-\d{2}/).first(),
    ).toBeVisible();

    // exam.startTime - endTime — HH:mm-HH:mm format
    await expect(firstCard.getByText(/\d{2}:\d{2}/).first()).toBeVisible();

    // exam.examMode — Exam.examMode is a raw string (e.g. "闭卷"), not locale-dependent
    await expect(
      firstCard.getByText(/闭卷|开卷|closed|open/i).first(),
    ).toBeVisible();

    // exam.examRooms[] — room name present
    const roomValue = firstCard.locator("dl dd").nth(2);
    await expect(roomValue).toHaveText(/\S/);
    await expect(roomValue).not.toHaveText(/TBD|待定|未定|—/i);

    // Cross-section exam cards must identify semester and exam batch metadata.
    await expect(
      firstCard.getByText(
        new RegExp(
          `${DEV_SEED.semesterNameCn}|${DEV_SEED.previousSemesterNameCn}`,
        ),
      ),
    ).toBeVisible();
    await expect(
      firstCard
        .getByText(DEV_SEED.examBatch.nameCn)
        .or(firstCard.getByText(DEV_SEED.examBatch.nameEn)),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "exams/card-fields");
  });

  test("考试卡片链接到班级详情页", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/exams", {
      testInfo,
      screenshotLabel: "exams",
    });

    await page
      .getByRole("group", { name: /考试|Exams/i })
      .getByRole("radio", { name: /全部|All/i })
      .click();

    const sectionLink = page
      .locator('#main-content a[href^="/sections/"]')
      .first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();

    await expect(page).toHaveURL(/\/sections\/\d+/);
    await captureStepScreenshot(page, testInfo, "exams/section-link");
  });

  test("已完成筛选显示过往考试，未完成显示即将到来", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/exams", {
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
    const endedExamCards = page.locator('[data-slot="card"]').filter({
      has: page.locator('a[href^="/sections/"]'),
    });
    await expect(endedExamCards.first()).toBeVisible({ timeout: 15_000 });
    await expect(
      endedExamCards
        .first()
        .getByText(/Ended|已结束|已完成/i)
        .first(),
    ).toBeVisible();
    await expect(
      endedExamCards
        .first()
        .getByText(
          new RegExp(
            `${DEV_SEED.semesterNameCn}|${DEV_SEED.previousSemesterNameCn}`,
          ),
        )
        .first(),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "exams/filter-completed");

    // Switch back to incomplete/upcoming
    const incompleteTab = filterTabs.getByRole("radio", {
      name: /Upcoming|即将|即将考试|待完成/i,
    });
    await incompleteTab.click();
    await expect(incompleteTab).toHaveAttribute("aria-checked", "true");
    await captureStepScreenshot(page, testInfo, "exams/filter-incomplete");
  });
});
