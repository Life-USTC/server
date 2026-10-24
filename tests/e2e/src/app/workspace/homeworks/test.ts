/**
 * E2E tests for the homeworks workspace (`/workspace/homeworks`)
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
 * - Desktop list rows expose a completion button; mobile uses cards
 * - Homework detail keeps completion and section navigation distinct
 * - Create homework button → modal form
 *
 * ## Edge Cases
 * - Unauthenticated legacy tab → protected semantic route, then sign-in
 * - Completion toggle calls PUT /api/workspace/homeworks/{id}/completion
 * - Empty state when filter yields no results
 */
import { expect } from "@playwright/test";
import {
  closeDetailDialog,
  detailDialog,
  expectComfortablePopupWidth,
  expectHomeworkDetailOrder,
  expectIconOnlyCloseButton,
  expectSingleColumnDiscussion,
} from "../../../../utils/detail-dialog";
import { test } from "../../../../utils/homework-fixture";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import {
  applyWorkspaceTaskFilter,
  openWorkspaceTaskFilter,
  workspaceTaskFilterControl,
} from "../../../../utils/workspace-task-filters";

test.describe("仪表盘作业", () => {
  test.describe.configure({ mode: "parallel" });

  test("登录后显示独立作业及所有必填字段", { tag: "@Homework/Web" }, async ({
    page,
    academic,
    homeworks,
    homeworkRun,
  }) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, "/workspace/homeworks");

        // Switch to All to see all homeworks
        await openWorkspaceTaskFilter(page, "homeworks");
        await applyWorkspaceTaskFilter(
          page,
          workspaceTaskFilterControl(page, /全部|All/i),
        );

        const hwRow = page
          .getByRole("row")
          .filter({ hasText: homeworks[1].title })
          .first();
        await expect(hwRow).toBeVisible();

        // homework.title
        await expect(hwRow.getByText(homeworks[1].title)).toBeVisible();
        await expect(hwRow.getByText(/\d{1,2}:\d{2}/).first()).toBeVisible();

        // section.course.namePrimary appears in the homework subtitle.
        await expect(
          hwRow
            .getByText(academic.course.nameCn)
            .or(hwRow.getByText(academic.course.nameEn))
            .first(),
        ).toBeVisible();

        const detailButton = hwRow.getByRole("button", {
          name: new RegExp(homeworks[1].title),
        });
        await page.keyboard.press("Escape");
        await detailButton.focus();
        await page.keyboard.press("Enter");
        await expect(
          page.locator('[data-slot="dialog-content"]').first(),
        ).toBeVisible();
        await page.keyboard.press("Escape");
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });

  test("协作作业显示重要和团队徽章", { tag: "@Homework/Web" }, async ({
    page,
    homeworks,
    homeworkRun,
  }) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, "/workspace/homeworks");

        await openWorkspaceTaskFilter(page, "homeworks");
        await applyWorkspaceTaskFilter(
          page,
          workspaceTaskFilterControl(page, /全部|All/i),
        );

        const hwRow = page
          .getByRole("row")
          .filter({ hasText: homeworks[1].title })
          .first();
        await expect(hwRow).toBeVisible();
        await expect(
          hwRow
            .locator('[data-slot="badge"]')
            .filter({ hasText: /重要|Major|重大/i }),
        ).toBeVisible();
        await expect(hwRow.getByText(/团队|Team/i)).toBeVisible();
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });

  test("可在筛选标签之间切换", { tag: "@Homework/Web" }, async ({
    page,
    homeworkStates,
    homeworkRun,
  }) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, "/workspace/homeworks");
        await expect(visibleText(page, homeworkStates[0].title)).toBeVisible();

        // Completed filter
        await openWorkspaceTaskFilter(page, "homeworks");
        const completedTab = workspaceTaskFilterControl(
          page,
          /已完成|Completed/i,
        ).first();
        await expect(completedTab).toBeVisible();
        await openWorkspaceTaskFilter(page, "homeworks");
        await applyWorkspaceTaskFilter(page, completedTab);
        await expect(visibleText(page, homeworkStates[1].title)).toBeVisible();
        await expect(visibleText(page, homeworkStates[0].title)).toHaveCount(0);
        // All filter
        await openWorkspaceTaskFilter(page, "homeworks");
        const allTab = workspaceTaskFilterControl(page, /全部|All/i).first();
        await expect(allTab).toBeVisible();
        await openWorkspaceTaskFilter(page, "homeworks");
        await applyWorkspaceTaskFilter(page, allTab);
        await expect(visibleText(page, homeworkStates[0].title)).toBeVisible();
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });

  test("作业详情弹窗单栏展示截止日期、讨论与图标关闭按钮", {
    tag: "@Homework/Web",
  }, async ({ page, homeworks, homeworkRun }) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, "/workspace/homeworks");

        await openWorkspaceTaskFilter(page, "homeworks");
        await applyWorkspaceTaskFilter(
          page,
          workspaceTaskFilterControl(page, /全部|All/i),
        );

        await page.keyboard.press("Escape");
        const row = page
          .getByRole("row")
          .filter({ hasText: homeworks[1].title })
          .first();
        await row
          .getByRole("button", { name: new RegExp(homeworks[1].title) })
          .first()
          .click();

        const dialog = detailDialog(page);
        await expect(dialog).toBeVisible();
        await expectHomeworkDetailOrder(dialog);
        await expectSingleColumnDiscussion(dialog);
        await expectComfortablePopupWidth(page, dialog);
        await expectIconOnlyCloseButton(dialog);
        await closeDetailDialog(page, dialog);
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });

  test("作业详情链接到教学班页面且不打开第二层详情", {
    tag: "@Homework/Web",
  }, async ({ page, academic, homeworks, homeworkRun }) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, "/workspace/homeworks");

        await openWorkspaceTaskFilter(page, "homeworks");
        await applyWorkspaceTaskFilter(
          page,
          workspaceTaskFilterControl(page, /全部|All/i),
        );

        await page.keyboard.press("Escape");
        const detailRow = page
          .getByRole("row")
          .filter({ hasText: homeworks[1].title })
          .first();
        await detailRow
          .getByRole("button", { name: new RegExp(homeworks[1].title) })
          .first()
          .click();
        const popout = page.locator('[data-slot="dialog-content"]').first();
        await expect(popout).toBeVisible();
        const sectionLink = popout
          .locator(`a[href="/catalog/sections/${academic.section.jwId}"]`)
          .first();
        await expect(sectionLink).toBeVisible();
        await sectionLink.click();

        await expect(page).toHaveURL(/\/catalog\/sections\/\d+$/);
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });
});
