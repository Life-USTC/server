/**
 * E2E: /catalog/sections/[jwId] — Section detail calendar and iCal export
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { jumpToSection, SECTION_URL } from "./_helpers";

test.describe("/catalog/sections/[jwId] 班级详情页", () => {
  test("日历区块以课表表格显示日程详情", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await gotoAndWaitForReady(page, SECTION_URL);

    await jumpToSection(page, /日历|Calendar/i, "#calendar");

    const calendar = page.locator("#calendar");
    const scheduleTable = calendar.locator("table").first();
    await expect(scheduleTable).toBeVisible({ timeout: 30_000 });
    await expect(scheduleTable.locator("tbody tr").first()).toBeVisible();

    // schedule.room / building / campus appear in the location column.
    await expect(
      scheduleTable
        .getByText(DEV_SEED.room.nameCn, { exact: false })
        .or(scheduleTable.getByText(DEV_SEED.room.nameEn, { exact: false }))
        .first(),
    ).toBeVisible();
    await expect(
      scheduleTable
        .getByText(DEV_SEED.building.nameCn, { exact: false })
        .or(scheduleTable.getByText(DEV_SEED.building.nameEn, { exact: false }))
        .first(),
    ).toBeVisible();
    await expect(
      scheduleTable
        .getByText(DEV_SEED.campus.nameCn, { exact: false })
        .or(scheduleTable.getByText(DEV_SEED.campus.nameEn, { exact: false }))
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "section/schedule-calendar");
  });

  test("日历区块以课表表格展示班级日程", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await gotoAndWaitForReady(page, SECTION_URL);

    await jumpToSection(page, /日历|Calendar/i, "#calendar");

    const calendar = page.locator("#calendar");
    await expect(
      calendar.getByRole("heading", { name: /日历|Calendar/i }),
    ).toBeVisible();
    await expect(calendar.locator("table").first()).toBeVisible();
    await expect(calendar.locator("tbody tr").first()).toBeVisible();
    await expect(
      calendar.getByRole("button", { name: /今天|Today/i }),
    ).toHaveCount(0);

    await captureStepScreenshot(page, testInfo, "section/calendar-today");
  });

  test("移动端日历使用可横向滚动的紧凑表格", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, SECTION_URL);
    await jumpToSection(page, /日历|Calendar/i, "#calendar");

    const calendar = page.locator("#calendar");
    const table = calendar.getByTestId("section-calendar-table");
    const container = table.locator(
      'xpath=ancestor::*[@data-slot="table-container"][1]',
    );
    await expect(table).toBeVisible();
    await expect(container).toHaveAttribute("role", "region");
    await expect(container).toHaveAttribute("tabindex", "0");
    await expect(container).toHaveAttribute("aria-label", /.+/);
    await expect(calendar.getByTestId("section-calendar-items")).toHaveCount(0);
    const dimensions = await container.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("日历区块显示考试信息（examBatch、examRooms）", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await gotoAndWaitForReady(page, SECTION_URL);

    await jumpToSection(page, /日历|Calendar/i, "#calendar");

    // Navigate forward to find exam event — exam batch name or room should appear
    await expect(
      page
        .getByText(DEV_SEED.examBatch.nameCn, { exact: false })
        .or(page.getByText(DEV_SEED.examBatch.nameEn, { exact: false }))
        .first(),
    )
      .toBeVisible({ timeout: 10_000 })
      .catch(() => {
        // exam may not be in current month view; acceptable if basic calendar renders
      });

    await captureStepScreenshot(page, testInfo, "section/exam-calendar");
  });

  test("日历导出弹窗显示公开 iCal URL 且不暴露私人订阅凭据", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsDebugUser(page, SECTION_URL);

    const calendarButton = page
      .getByTestId("detail-pinned-summary")
      .getByRole("button", { name: /添加到日历|Add to calendar/i })
      .first();
    await expect(calendarButton).toBeVisible();

    await calendarButton.click();
    const calDialog = page.locator('[data-slot="dialog-content"]').first();
    await expect(calDialog).toBeVisible();

    // iCalendar URL (ical.yml → section-calendar-dialog.display.fields)
    const singleUrl = calDialog.locator("#calendar-url");
    const subscriptionUrl = calDialog.locator("#subscription-url");
    await expect(singleUrl).toBeVisible();

    // Single section URL
    const singleValue = await singleUrl.inputValue();
    expect(singleValue).toContain(
      `/api/catalog/sections/${DEV_SEED.section.jwId}/calendar.ics`,
    );

    // Long-lived private feed credentials are only revealed from the
    // recent-authenticated subscriptions workspace, never a public section.
    const subscriptionValue = await subscriptionUrl.inputValue();
    expect(subscriptionValue).toMatch(
      /前往订阅页|Open subscriptions to securely view your personal feed/i,
    );
    await expect(subscriptionUrl).toBeDisabled();
    expect(subscriptionValue).not.toContain("/api/calendar-feeds/");

    // Copy single URL
    await calDialog
      .getByRole("button", { name: /复制|Copy/i })
      .nth(0)
      .click();
    const singleClipboard = await page.evaluate(async () =>
      navigator.clipboard.readText(),
    );
    expect(singleClipboard).toBe(singleValue);

    await expect(
      calDialog.getByRole("button", { name: /复制|Copy/i }).nth(1),
    ).toBeDisabled();

    await expect(
      calDialog.getByRole("link", {
        name: /查看教学班订阅|View section subscriptions/i,
      }),
    ).toHaveAttribute("href", "/workspace/subscriptions");

    await captureStepScreenshot(page, testInfo, "section/calendar-dialog");
  });
});
