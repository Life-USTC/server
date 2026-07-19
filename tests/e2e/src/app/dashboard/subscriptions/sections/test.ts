/**
 * E2E tests for the subscriptions dashboard (`/dashboard/subscriptions`)
 *
 * ## Data Represented (subscribed-sections.yml → subscribed-sections-tab.display.fields)
 * - semester group label
 * - subscription.sections[].code
 * - subscription.sections[].course.namePrimary
 * - section.teachers[]
 * - section.credits
 * - Unsubscribe button per section
 * - Calendar subscription URL for iCal feed
 *
 * ## UI/UX Elements
 * - Table with columns: section code, course name, teachers, credits, opt-out
 * - All table cells (except opt-out) are links to `/sections/{jwId}`
 * - Semester header with sections grouped by term
 * - Bulk import dialog (textarea → query section/course codes → confirm dialog)
 * - iCal calendar link copy button
 * - Opt-out button: initial → confirm → success states
 * - Empty state with bulk import + browse courses buttons
 *
 * ## Edge Cases
 * - Unauthenticated users see the public dashboard view (subscriptions is auth-only)
 * - Bulk import with invalid codes shows only matched sections in dialog
 * - Calendar link format: /api/users/{userId}:{token}/calendar.ics
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../../utils/page-ready";
import { absoluteTestUrl } from "../../../../../utils/request-url";
import { captureStepScreenshot } from "../../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../../utils/subscriptions";

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function openBulkImportDialog(page: import("@playwright/test").Page) {
  const textarea = page.getByRole("textbox", {
    name: /班级或课程代码|Section or course codes|粘贴|Paste/i,
  });
  if ((await textarea.count()) === 0) {
    await page
      .getByRole("button", {
        name: /批量导入班级|Bulk Import Sections/i,
      })
      .first()
      .click();
  }
  await expect(textarea.first()).toBeVisible({ timeout: 5_000 });
  return textarea.first();
}

test.describe("仪表盘关注班级", () => {
  test.describe.configure({ mode: "serial" });

  test("旧版 /dashboard/subscriptions/sections 重定向到关注班级页面", async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await gotoAndWaitForReady(page, "/dashboard/subscriptions/sections");

    await expect(page).toHaveURL(/\/dashboard\/subscriptions(?:\?.*)?$/);
  });

  test("未登录旧 subscriptions tab 重定向到语义路径", async ({ page }) => {
    const response = await page.request.get(
      "/?tab=subscriptions&semester=2026-spring",
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      "/dashboard/subscriptions?semester=2026-spring",
    );
  });

  test("登录后显示种子班级关注、必填字段和英文单复数文案", async ({
    page,
    baseURL,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await expect(async () => {
      await ensureSeedSectionSubscription(page);
      await gotoAndWaitForReady(page, "/dashboard/subscriptions");

      await expect(page).toHaveURL(/\/dashboard\/subscriptions(?:\?.*)?$/);
      await expect(page.locator("#main-content")).toBeVisible();

      const subscriptionsContent = page.locator("#main-content").first();
      await expect(
        subscriptionsContent.locator("a[href^='/sections/']").first(),
      ).toBeVisible({ timeout: 3_000 });

      // subscription.sections[].course.namePrimary
      await expect(
        subscriptionsContent
          .getByText(DEV_SEED.course.nameCn)
          .or(subscriptionsContent.getByText(DEV_SEED.course.nameEn))
          .first(),
      ).toBeVisible({ timeout: 3_000 });
      // subscription.sections[].code
      await expect(
        subscriptionsContent.getByText(DEV_SEED.section.code).first(),
      ).toBeVisible({
        timeout: 3_000,
      });
      // section.teachers[] (locale-dependent)
      await expect(
        subscriptionsContent
          .getByText(DEV_SEED.teacher.nameCn)
          .or(subscriptionsContent.getByText(DEV_SEED.teacher.nameEn))
          .first(),
      ).toBeVisible({ timeout: 3_000 });
      // section.credits
      await expect(
        subscriptionsContent
          .getByText(String(DEV_SEED.section.credits))
          .first(),
      ).toBeVisible({ timeout: 3_000 });
      // semester group label — semester name shown as group header
      await expect(page.getByText(DEV_SEED.semesterNameCn).first()).toBeVisible(
        {
          timeout: 3_000,
        },
      );
    }).toPass({
      timeout: 20_000,
      intervals: [500, 1_000, 2_000],
    });

    await captureStepScreenshot(page, testInfo, "subscriptions/seed-fields");
    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "en-us",
        url: absoluteTestUrl("/", baseURL),
        sameSite: "Lax",
      },
    ]);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    await expect(
      page.getByText("3 sections included", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("1 section included", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("1 sections included", { exact: true }),
    ).toHaveCount(0);
    await captureStepScreenshot(
      page,
      testInfo,
      "subscriptions/single-section-en-us",
    );
  });

  test("空状态提供发现操作", async ({ page }, testInfo) => {
    test.setTimeout(60000);
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");
    await expect(async () => {
      const bulkImportButton = page.getByRole("button", {
        name: /批量导入班级|Bulk Import Sections/i,
      });
      const browseSectionsLink = page.getByRole("link", {
        name: /浏览班级|Browse Sections/i,
      });
      const browseCoursesLink = page.getByRole("link", {
        name: /浏览课程|Browse Courses/i,
      });
      if ((await browseSectionsLink.count()) === 0) {
        const rowActionButton = page
          .getByRole("button", { name: /移除|Opt out|确认|Confirm/i })
          .first();
        const rowActionLabel = (await rowActionButton.textContent()) ?? "";
        if (/确认|Confirm/i.test(rowActionLabel)) {
          await rowActionButton.click({ force: true });
        } else {
          await rowActionButton.click({ force: true });
          await expect(
            page.getByRole("button", { name: /确认|Confirm/i }).first(),
          ).toBeVisible({ timeout: 3_000 });
          await page
            .getByRole("button", { name: /确认|Confirm/i })
            .first()
            .click({ force: true });
        }
      }

      await waitForUiSettled(page);
      await expect(bulkImportButton).toBeVisible({ timeout: 3_000 });
      await expect(browseSectionsLink).toBeVisible({ timeout: 3_000 });
      await expect(browseCoursesLink).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 30_000,
      intervals: [500, 1_000, 2_000],
    });

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-empty-state",
    );
  });

  test("可从关注行导航到班级详情", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    const rowLink = page.locator("#main-content a[href^='/sections/']").first();
    await expect(rowLink).toBeVisible();
    await rowLink.click();

    await expect(page).toHaveURL(/\/sections\/\d+/);
    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-navigate-section",
    );
  });

  test("退选按钮进入确认状态", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    const optOutButton = page
      .getByRole("button", {
        name: /移除|Opt out/i,
      })
      .first();
    await expect(optOutButton).toBeVisible();
    await optOutButton.click();

    await expect(
      page.getByRole("button", { name: /确认|Confirm/i }).first(),
    ).toBeVisible();

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-opt-out-confirm",
    );
  });

  test("复制日历链接生成有效的 iCal URL", async ({ page }, testInfo) => {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    const copyButton = page
      .getByRole("button", { name: /复制日历链接|iCal/i })
      .first();
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    const clipboardText = await page.evaluate(async () =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toContain("calendar.ics");
    expect(clipboardText).toMatch(/\/api\/users\/[^/]+:[^/]+\/calendar\.ics$/);

    // Verify the calendar endpoint returns valid iCal data
    const calendarResponse = await page.request.get(clipboardText);
    expect(calendarResponse.status()).toBe(200);
    expect(calendarResponse.headers()["content-type"]).toContain(
      "text/calendar",
    );
    const calendarBody = await calendarResponse.text();
    expect(calendarBody).toContain("BEGIN:VCALENDAR");

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-ical-copied",
    );
  });

  test("批量导入打开确认对话框并可取消", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/dashboard/subscriptions");

    const textarea = await openBulkImportDialog(page);
    await textarea.fill(DEV_SEED.section.code);

    const matchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/calendar-subscriptions/query") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: /识别并匹配课程|Match/i }).click();
    await matchResponse;

    const dialog = page
      .getByRole("dialog", { name: /确认关注|Confirm following/i })
      .first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const matchedSectionCheckbox = dialog
      .getByRole("checkbox", {
        name: new RegExp(
          `选择 ${escapeForRegExp(DEV_SEED.section.code)}|Select ${escapeForRegExp(DEV_SEED.section.code)}`,
          "i",
        ),
      })
      .first();
    await expect(matchedSectionCheckbox).toBeChecked();
    await matchedSectionCheckbox.click();
    await expect(matchedSectionCheckbox).not.toBeChecked();
    await matchedSectionCheckbox.click();
    await expect(matchedSectionCheckbox).toBeChecked();

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-bulk-import-dialog",
    );

    await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("批量导入可确认并显示成功", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/dashboard/subscriptions");

    const textarea = await openBulkImportDialog(page);
    // Include a valid code and an invalid one
    await textarea.fill(`\n${DEV_SEED.section.code}\nDEVXX000.99\n`);

    const matchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/calendar-subscriptions/query") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: /识别并匹配课程|Match/i }).click();
    await matchResponse;

    const dialog = page
      .getByRole("dialog", { name: /确认关注|Confirm following/i })
      .first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(DEV_SEED.section.code).first()).toBeVisible();

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-bulk-import-ready",
    );

    await dialog
      .getByRole("button", {
        name: /关注已选的 \d+ 个班级|关注已选|Follow \d+ sections|Follow/i,
      })
      .click();

    await expect(
      page
        .getByText(
          /已新增关注 \d+ 个班级|Added \d+ new sections? to Life@USTC/i,
        )
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-bulk-import-success",
    );
  });
});
