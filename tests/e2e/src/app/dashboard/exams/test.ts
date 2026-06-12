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

test.describe("dashboard exams", () => {
  test("unauthenticated ?tab=exams shows public view (no exams tab)", async ({
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
      page.getByRole("tab", { name: /^(网站|Websites)$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
    ).toBeVisible();
    // Exams tab should NOT appear in public nav
    await expect(
      page.getByRole("tab", { name: /^(考试|Exams)$/i }),
    ).toHaveCount(0);

    await captureStepScreenshot(page, testInfo, "exams/unauthenticated");
  });

  test("authenticated shows exam filter toolbar and cards", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/exams", {
      testInfo,
      screenshotLabel: "exams",
    });

    await expect(page.locator("#main-content")).toBeVisible();

    // Filter toolbar (exam.yml cross-section-exam-list.display.fields: completion filter)
    // In English locale: "Upcoming" / "Ended" / "All"
    const filterTabs = page.getByRole("tablist", { name: /考试|Exams/i });
    await expect(
      filterTabs.getByRole("tab", { name: /全部|All/i }),
    ).toBeVisible();
    // "Ended" in English, "已结束" or "已完成" in Chinese
    await expect(
      filterTabs.getByRole("tab", { name: /Ended|已结束|已完成/i }),
    ).toBeVisible();
    await expect(
      filterTabs.getByRole("tab", { name: /Upcoming|即将|即将考试|待完成/i }),
    ).toHaveAttribute("aria-selected", "true");

    await captureStepScreenshot(page, testInfo, "exams/filter-toolbar");
  });

  test("exam cards display required fields (course name, date, times, mode, rooms)", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/exams", {
      testInfo,
      screenshotLabel: "exams",
    });

    // Switch to "all" to see all exams regardless of completion
    const filterTabs = page.getByRole("tablist", { name: /考试|Exams/i });
    await filterTabs.getByRole("tab", { name: /全部|All/i }).click();
    await expect(
      filterTabs.getByRole("tab", { name: /全部|All/i }),
    ).toHaveAttribute("aria-selected", "true");

    // exam cards should be visible
    const examCards = page.locator('[data-slot="card"]').filter({
      has: page.locator('a[href^="/sections/"]'),
    });
    await expect(examCards.first()).toBeVisible({ timeout: 15_000 });

    const firstCard = examCards.first();
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
    await expect(firstCard.getByText(/考场|room|一教/i).first()).toBeVisible();

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

  test("exam card links to section detail page", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/exams", {
      testInfo,
      screenshotLabel: "exams",
    });

    await page
      .getByRole("tablist", { name: /考试|Exams/i })
      .getByRole("tab", { name: /全部|All/i })
      .click();

    const sectionLink = page.locator('a[href^="/sections/"]').first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();

    await expect(page).toHaveURL(/\/sections\/\d+/);
    await captureStepScreenshot(page, testInfo, "exams/section-link");
  });

  test("completed filter shows past exams, incomplete shows upcoming", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/exams");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/exams", {
      testInfo,
      screenshotLabel: "exams",
    });

    const filterTabs = page.getByRole("tablist", { name: /考试|Exams/i });

    // Switch to completed/ended filter
    const completedTab = filterTabs.getByRole("tab", {
      name: /Ended|已结束|已完成/i,
    });
    await completedTab.click();
    await expect(completedTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(DEV_SEED.previousSemesterNameCn)).toBeVisible();
    await captureStepScreenshot(page, testInfo, "exams/filter-completed");

    // Switch back to incomplete/upcoming
    const incompleteTab = filterTabs.getByRole("tab", {
      name: /Upcoming|即将|即将考试|待完成/i,
    });
    await incompleteTab.click();
    await expect(incompleteTab).toHaveAttribute("aria-selected", "true");
    await captureStepScreenshot(page, testInfo, "exams/filter-incomplete");
  });
});
