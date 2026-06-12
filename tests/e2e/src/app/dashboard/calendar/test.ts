/**
 * E2E tests for the calendar dashboard (`/dashboard/calendar`)
 *
 * ## Data Represented (calendar.yml → personal-calendar-view.display.fields)
 * - calendarEvents (schedules + exams + homeworks + todos)
 * - schedule.date, startTime, endTime
 * - exam.examDate, startTime, endTime, examMode, examRooms
 * - homework.submissionDueAt
 * - todo.dueAt
 * - Week numbers
 * - Weekday labels (Sun-Sat)
 *
 * ## Features
 * - View tabs: semester (default) / month / week
 * - Navigation: prev/next semester, month, or week
 * - Section links from calendar events
 * - Copy calendar link button (iCal)
 *
 * ## Edge Cases
 * - Unauthenticated → public links view (calendar auth-only)
 * - Different layout per view mode
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../utils/subscriptions";

test.describe("dashboard calendar", () => {
  test("unauthenticated ?tab=calendar shows public view", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=calendar", {
      testInfo,
      screenshotLabel: "calendar",
    });

    await expect(page).toHaveURL(/\/\?tab=calendar$/);
    await expect(page.locator("#main-content")).toBeVisible();

    // Public view: links/bus tabs, sign-in CTA
    await expect(
      page.getByRole("tab", { name: /^(网站|Websites)$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
    ).toBeVisible();
    // Calendar tab NOT in public nav
    await expect(
      page.getByRole("tab", { name: /^(日历|Calendar)$/i }),
    ).toHaveCount(0);

    await captureStepScreenshot(page, testInfo, "calendar/unauthenticated");
  });

  test("authenticated shows calendar with section event links and weekday labels", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/calendar");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/calendar", {
      testInfo,
      screenshotLabel: "calendar",
    });

    await expect(page.locator("#main-content")).toBeVisible();

    // Weekday labels (Sun-Sat) — calendar.yml personal-calendar-view.display.fields
    await expect(
      page
        .getByText(/Sun|Mon|Tue|Wed|Thu|Fri|Sat|日|一|二|三|四|五|六/)
        .first(),
    ).toBeVisible();

    // Section links from schedule events
    const sectionLink = page.locator('a[href^="/sections/"]').first();
    await expect(sectionLink).toBeVisible();

    await captureStepScreenshot(page, testInfo, "calendar/semester-view");
  });

  test("section event link navigates to section detail", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/calendar");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/calendar", {
      testInfo,
      screenshotLabel: "calendar",
    });

    const sectionLink = page.locator('a[href^="/sections/"]').first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();

    await expect(page).toHaveURL(/\/sections\/\d+/);
    await captureStepScreenshot(page, testInfo, "calendar/section-link");
  });

  test("exam card links to exams tab", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/calendar");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/calendar", {
      testInfo,
      screenshotLabel: "calendar",
    });

    const examLink = page.locator('a[href="/dashboard/exams"]').first();
    await expect(examLink).toBeVisible();
    await examLink.click();
    await expect(page).toHaveURL(/\/dashboard\/exams(?:\?.*)?$/);
    await captureStepScreenshot(page, testInfo, "calendar/exam-link");
  });

  test("semester navigation controls are present", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/calendar");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/calendar", {
      testInfo,
      screenshotLabel: "calendar",
    });

    // calendar.yml: Previous/next semester controls
    await expect(page.getByText(/上一学期|Previous semester/i)).toBeVisible();
    await expect(page.getByText(/下一学期|Next semester/i)).toBeVisible();

    await captureStepScreenshot(page, testInfo, "calendar/navigation-controls");
  });

  test("view toggle switches between semester/month/week", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/calendar");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/calendar", {
      testInfo,
      screenshotLabel: "calendar",
    });

    // calendar.yml: View tabs
    const calendarTabs = page.getByRole("tablist", {
      name: /日历|Calendar/i,
    });
    const monthTab = calendarTabs.getByRole("tab", {
      name: /本月|This month/i,
    });
    await monthTab.click();
    await expect(page).toHaveURL(/calendarView=month/);
    await expect(monthTab).toHaveAttribute("aria-selected", "true");
    await captureStepScreenshot(page, testInfo, "calendar/month-view");

    const weekTab = calendarTabs.getByRole("tab", {
      name: /本周|This week/i,
    });
    await weekTab.click();
    await expect(page).toHaveURL(/calendarView=week/);
    await expect(weekTab).toHaveAttribute("aria-selected", "true");
    await captureStepScreenshot(page, testInfo, "calendar/week-view");
  });

  test("copy calendar link produces valid iCal URL", async ({ page }) => {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsDebugUser(page, "/dashboard/calendar");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/calendar");

    const copyButton = page.getByRole("button", { name: /复制日历链接|iCal/i });
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    const clipboardText = await page.evaluate(async () =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toMatch(/\/api\/users\/[^/]+:[^/]+\/calendar\.ics$/);

    const calendarResponse = await page.request.get(clipboardText);
    expect(calendarResponse.status()).toBe(200);
    expect(calendarResponse.headers()["content-type"]).toContain(
      "text/calendar",
    );
    await expect(page.getByText(/已复制链接|Link Copied/i)).toBeVisible();
  });
});
