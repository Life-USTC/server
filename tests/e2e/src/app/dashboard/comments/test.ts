/**
 * E2E tests for invalid tab fallback (`?tab=comments`)
 *
 * ## Data Represented
 * - There is no "comments" tab in the dashboard. Valid authenticated tabs are:
 *   overview, calendar, bus, links, homeworks, todos, exams, subscriptions.
 * - Valid public tabs are: bus, links.
 *
 * ## UI/UX Elements
 * - Public view: falls back to bus tab content (default public tab)
 * - Authenticated view: falls back to overview tab content
 *
 * ## Edge Cases
 * - `?tab=comments` is not a recognized tab value — the app silently falls
 *   back to the default tab without redirecting. The URL retains `?tab=comments`.
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe("dashboard invalid tab (comments)", () => {
  test("/dashboard/comments is not a routed dashboard page", async ({
    page,
  }, testInfo) => {
    const response = await gotoAndWaitForReady(page, "/dashboard/comments", {
      testInfo,
      screenshotLabel: "dashboard-invalid-comments-route",
    });

    expect(response?.status()).toBe(404);
    await expect(page.getByText(/not found|找不到/i)).toBeVisible();
  });

  test("unauthenticated ?tab=comments falls back to public bus view", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=comments", {
      testInfo,
      screenshotLabel: "dashboard-invalid-tab",
    });

    // URL retains the invalid tab param
    await expect(page).toHaveURL(/\/\?tab=comments$/);
    await expect(page.locator("#app-logo")).toBeVisible();

    // Public view renders bus content as default (bus + links grouped)
    await expect(
      page.getByRole("tab", { name: /^(校车|Shuttle Bus)$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
    ).toBeVisible();
    // Bus toolbar should be visible (day type pills)
    await expect(
      page.getByText(/Weekday|Weekend|工作日|周末/).first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "home-comments-public");
  });

  test("authenticated ?tab=comments falls back to overview", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/?tab=comments");

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("#app-user-menu")).toBeVisible();

    // Overview is the fallback — should show the overview tab as active
    await expect(
      page.getByRole("tab", { name: /^(总览|Overview)$/i }),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "home-comments-seed");
  });
});
