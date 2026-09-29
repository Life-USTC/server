/**
 * E2E tests for the exams workspace (`/workspace/exams`)
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
import { expect } from "@playwright/test";
import { test } from "../../../../utils/academic-events";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe("仪表盘考试", () => {
  test.describe.configure({ mode: "parallel" });

  test("登录后显示考试筛选工具栏和列表", async ({
    page,
    pastExam: _pastExam,
    homeworkRun,
  }, testInfo) => {
    await homeworkRun(
      async () => {
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
        // This case owns only a past exam; the default upcoming filter stays empty.
        await expect(
          filterTabs.locator('[data-value="incomplete"]'),
        ).toHaveAttribute("aria-checked", "true");
        await expect(
          page
            .getByText(/当前筛选下暂无考试|No exams under this filter/i)
            .filter({ visible: true }),
        ).toBeVisible();
        await filterTabs.getByRole("radio", { name: /全部|All/i }).click();
        await expect(
          page
            .getByRole("table")
            .getByRole("row")
            .filter({
              has: page.locator('a[href^="/catalog/sections/"]'),
            })
            .first(),
        ).toBeVisible();

        await captureStepScreenshot(
          page,
          testInfo,
          "exams/filter-empty-cleared",
        );
      },
      { calendarMessages: [], calendarTokenCreated: true },
    );
  });

  test("考试列表显示必填字段", async ({
    page,
    academic,
    pastExam: _pastExam,
    homeworkRun,
  }, testInfo) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, "/workspace/exams", {
          testInfo,
          screenshotLabel: "exams",
        });

        // Switch to "all" to see all exams regardless of completion
        const filterTabs = page.getByRole("group", { name: /考试|Exams/i });
        const allTab = filterTabs.getByRole("radio", { name: /全部|All/i });
        if ((await allTab.getAttribute("aria-checked")) !== "true") {
          await allTab.click();
        }
        await expect(allTab).toHaveAttribute("aria-checked", "true");

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
              `${academic.course.nameCn}|${academic.course.nameEn}`,
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
      },
      { calendarMessages: [], calendarTokenCreated: true },
    );
  });

  test("考试列表链接到班级详情页", async ({
    page,
    pastExam: _pastExam,
    homeworkRun,
  }, testInfo) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, "/workspace/exams", {
          testInfo,
          screenshotLabel: "exams",
        });

        const allTab = page
          .getByRole("group", { name: /考试|Exams/i })
          .getByRole("radio", { name: /全部|All/i });
        if ((await allTab.getAttribute("aria-checked")) !== "true") {
          await allTab.click();
        }

        const sectionLink = page
          .getByRole("table")
          .locator('a[href^="/catalog/sections/"]')
          .first();
        await expect(sectionLink).toBeVisible();
        await sectionLink.click();

        await expect(page).toHaveURL(/\/catalog\/sections\/\d+/);
        await captureStepScreenshot(page, testInfo, "exams/section-link");
      },
      { calendarMessages: [], calendarTokenCreated: true },
    );
  });

  test("已完成筛选显示过往考试，未完成显示即将到来", async ({
    page,
    pastExam: _pastExam,
    homeworkRun,
  }, testInfo) => {
    await homeworkRun(
      async () => {
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
          endedExamRows
            .first()
            .locator('a[href^="/catalog/sections/"]')
            .first(),
        ).toHaveText(/.+/);
        await captureStepScreenshot(page, testInfo, "exams/filter-completed");

        // Switching back to upcoming retains an empty selection.
        const incompleteTab = filterTabs.getByRole("radio", {
          name: /Upcoming|即将|即将考试|待完成|未结束/i,
        });
        await incompleteTab.click();
        await expect(incompleteTab).toHaveAttribute("aria-checked", "true");
        await expect(endedExamRows).toHaveCount(0);
        await expect(
          page
            .getByText(/当前筛选下暂无考试|No exams under this filter/i)
            .filter({ visible: true }),
        ).toBeVisible();
        await captureStepScreenshot(page, testInfo, "exams/filter-incomplete");
      },
      { calendarMessages: [], calendarTokenCreated: true },
    );
  });
});
