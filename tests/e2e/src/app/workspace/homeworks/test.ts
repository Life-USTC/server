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
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import {
  closeDetailDialog,
  detailDialog,
  expectComfortablePopupWidth,
  expectHomeworkDetailOrder,
  expectIconOnlyCloseButton,
  expectSingleColumnDiscussion,
} from "../../../../utils/detail-dialog";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../utils/subscriptions";

test.describe("仪表盘作业", () => {
  test.describe.configure({ mode: "serial" });

  test("未登录旧 homework tab 重定向到语义路径", async ({ page }) => {
    const response = await page.request.get(
      "/?tab=homeworks&homeworkView=list",
      {
        maxRedirects: 0,
      },
    );

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      "/workspace/homeworks?homeworkView=list",
    );
  });

  test("未登录语义路径要求登录", async ({ page }) => {
    const response = await page.request.get("/workspace/homeworks", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe(
      "/account/sign-in?callbackUrl=%2Fworkspace%2Fhomeworks",
    );
  });

  test("登录后显示种子作业及所有必填字段", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    // Switch to All to see all homeworks
    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const hwRow = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(hwRow).toBeVisible();

    // homework.title
    await expect(hwRow.getByText(DEV_SEED.homeworks.title)).toBeVisible();
    await expect(hwRow.getByText(/\d{1,2}:\d{2}/).first()).toBeVisible();

    // section.course.namePrimary appears in the homework subtitle.
    await expect(
      hwRow
        .getByText(DEV_SEED.course.nameCn)
        .or(hwRow.getByText(DEV_SEED.course.nameEn))
        .first(),
    ).toBeVisible();

    const detailButton = hwRow.getByRole("button", {
      name: new RegExp(DEV_SEED.homeworks.title),
    });
    await detailButton.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.locator('[data-slot="dialog-content"]').first(),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await captureStepScreenshot(page, testInfo, "homeworks/seed-list-fields");
  });

  test("种子协作作业显示重要和团队徽章", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const hwRow = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(hwRow).toBeVisible();
    await expect(hwRow.getByText(/重要|Major|重大/i)).toBeVisible();
    await expect(hwRow.getByText(/团队|Team/i)).toBeVisible();

    await captureStepScreenshot(page, testInfo, "homeworks/major-team-badges");
  });

  test("可在筛选标签之间切换", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });
    await expect(
      visibleText(page, DEV_SEED.homeworks.overdueTitle),
    ).toBeVisible();

    // Completed filter
    const completedTab = page
      .getByRole("radio", { name: /已完成|Completed/i })
      .first();
    await expect(completedTab).toBeVisible();
    await completedTab.click();
    await expect(
      visibleText(page, DEV_SEED.homeworks.completedTitle),
    ).toBeVisible();
    await expect(
      visibleText(page, DEV_SEED.homeworks.overdueTitle),
    ).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "homeworks/filter-completed");

    // All filter
    const allTab = page.getByRole("radio", { name: /全部|All/i }).first();
    await expect(allTab).toBeVisible();
    await allTab.click();
    await expect(
      visibleText(page, DEV_SEED.homeworks.overdueTitle),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "homeworks/filter-all");
  });

  test("作业详情弹窗单栏展示截止日期、讨论与图标关闭按钮", async ({ page }) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks");

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const row = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await row
      .getByRole("button", { name: new RegExp(DEV_SEED.homeworks.title) })
      .first()
      .click();

    const dialog = detailDialog(page);
    await expect(dialog).toBeVisible();
    await expectHomeworkDetailOrder(dialog);
    await expectSingleColumnDiscussion(dialog);
    await expectComfortablePopupWidth(page, dialog);
    await expectIconOnlyCloseButton(dialog);
    await closeDetailDialog(page, dialog);
  });

  test("作业详情链接到班级页面且不打开第二层详情", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const detailRow = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await detailRow
      .getByRole("button", { name: new RegExp(DEV_SEED.homeworks.title) })
      .first()
      .click();
    const popout = page.locator('[data-slot="dialog-content"]').first();
    await expect(popout).toBeVisible();
    const sectionLink = popout
      .locator(`a[href="/catalog/sections/${DEV_SEED.section.jwId}"]`)
      .first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();

    await expect(page).toHaveURL(/\/catalog\/sections\/\d+$/);
    await captureStepScreenshot(page, testInfo, "homeworks/view-details");
  });
});
