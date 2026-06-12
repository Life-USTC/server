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
 * - Bulk import dialog (textarea → match codes → confirm dialog)
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
import { captureStepScreenshot } from "../../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../../utils/subscriptions";

test.describe("dashboard subscriptions", () => {
  test.describe.configure({ mode: "serial" });

  test("legacy /dashboard/subscriptions/sections redirects to subscriptions page", async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await gotoAndWaitForReady(page, "/dashboard/subscriptions/sections");

    await expect(page).toHaveURL(/\/dashboard\/subscriptions(?:\?.*)?$/);
  });

  test("unauthenticated ?tab=subscriptions falls back to public view", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=subscriptions");

    await expect(page).toHaveURL(/\/\?tab=subscriptions$/);
    await expect(page.locator("#main-content")).toBeVisible();

    await expect(
      page.getByRole("tab", { name: /^(网站|Websites)$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
    ).toBeVisible();

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-unauthorized",
    );
  });

  test("authenticated shows seed section subscription with all required fields", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await expect(async () => {
      await ensureSeedSectionSubscription(page);
      await gotoAndWaitForReady(page, "/dashboard/subscriptions");

      await expect(page).toHaveURL(/\/dashboard\/subscriptions(?:\?.*)?$/);
      await expect(page.locator("#main-content")).toBeVisible();

      const subscriptionsTable = page.locator("tbody").first();
      await expect(subscriptionsTable).toBeVisible({ timeout: 3_000 });

      // subscription.sections[].course.namePrimary
      await expect(
        subscriptionsTable
          .getByText(DEV_SEED.course.nameCn)
          .or(subscriptionsTable.getByText(DEV_SEED.course.nameEn))
          .first(),
      ).toBeVisible({ timeout: 3_000 });
      // subscription.sections[].code
      await expect(
        subscriptionsTable.getByText(DEV_SEED.section.code).first(),
      ).toBeVisible({
        timeout: 3_000,
      });
      // section.teachers[] (locale-dependent)
      await expect(
        subscriptionsTable
          .getByText(DEV_SEED.teacher.nameCn)
          .or(subscriptionsTable.getByText(DEV_SEED.teacher.nameEn))
          .first(),
      ).toBeVisible({ timeout: 3_000 });
      // section.credits
      await expect(
        subscriptionsTable.getByText(String(DEV_SEED.section.credits)).first(),
      ).toBeVisible({ timeout: 3_000 });
      // semester group label — semester name shown as group header
      await expect(page.getByText(DEV_SEED.semesterNameCn).first()).toBeVisible(
        {
          timeout: 3_000,
        },
      );
      await expect(
        page.getByText(DEV_SEED.previousSemesterNameCn).first(),
      ).toBeVisible({
        timeout: 3_000,
      });
    }).toPass({
      timeout: 20_000,
      intervals: [500, 1_000, 2_000],
    });

    await captureStepScreenshot(page, testInfo, "subscriptions/seed-fields");
  });

  test("empty state offers discovery actions", async ({ page }, testInfo) => {
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
        const firstRow = page.locator("tbody tr").first();
        await firstRow.hover();
        const rowActionButton = firstRow
          .getByRole("button", { name: /移除|Opt out|确认|Confirm/i })
          .first();
        const rowActionLabel = (await rowActionButton.textContent()) ?? "";
        if (/确认|Confirm/i.test(rowActionLabel)) {
          await rowActionButton.click({ force: true });
        } else {
          await rowActionButton.click({ force: true });
          await expect(
            firstRow.getByRole("button", { name: /确认|Confirm/i }),
          ).toBeVisible({ timeout: 3_000 });
          await firstRow
            .getByRole("button", { name: /确认|Confirm/i })
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

  test("can navigate to section detail from table row", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    const rowLink = page.locator("tbody a[href^='/sections/']").first();
    await expect(rowLink).toBeVisible();
    await rowLink.click();

    await expect(page).toHaveURL(/\/sections\/\d+/);
    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-navigate-section",
    );
  });

  test("opt-out button enters confirm state", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();
    await firstRow.hover();

    const optOutButton = firstRow.getByRole("button", {
      name: /移除|Opt out/i,
    });
    await expect(optOutButton).toBeVisible();
    await optOutButton.click();

    await expect(
      firstRow.getByRole("button", { name: /确认|Confirm/i }),
    ).toBeVisible();

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-opt-out-confirm",
    );
  });

  test("copy calendar link produces valid iCal URL", async ({
    page,
  }, testInfo) => {
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

  test("bulk import opens confirm dialog and can cancel", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/dashboard/subscriptions");

    const textarea = page.getByRole("textbox", {
      name: /班级代码|Section codes|粘贴|Paste/i,
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

    await textarea.first().fill(DEV_SEED.section.code);

    const matchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/sections/match-codes") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: /识别并匹配课程|Match/i }).click();
    await matchResponse;

    const dialog = page
      .getByRole("dialog", { name: /确认关注|Confirm following/i })
      .first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-bulk-import-dialog",
    );

    await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("bulk import can confirm and shows success", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/dashboard/subscriptions");

    const textarea = page.getByRole("textbox", {
      name: /班级代码|Section codes|粘贴|Paste/i,
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

    // Include a valid code and an invalid one
    await textarea.first().fill(`\n${DEV_SEED.section.code}\nDEVXX000.99\n`);

    const matchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/sections/match-codes") &&
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
        .getByText(/已成功关注 \d+ 个班级|Now following \d+ sections/i)
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
