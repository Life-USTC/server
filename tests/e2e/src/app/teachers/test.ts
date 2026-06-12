/**
 * E2E tests for /teachers — Teacher Search Page
 *
 * ## Data Represented
 * - Teachers with code, name (cn/en), department, title, sections
 * - Seed teacher: DEV_SEED.teacher (dynamic id, resolved via search)
 * - Department filter backed by getSeedTeacherDepartmentFixture
 *
 * ## UI/UX Elements
 * - h1: "教师" / "Teachers"
 * - SearchBox with search button and clear button
 * - Department filter dropdown from URL param
 * - Table with teacher name linking to /teachers/[id]
 * - Server-side rendered HTML with search params
 *
 * ## Edge Cases
 * - Teacher IDs are dynamic (no static DEV_SEED.teacher.id)
 * - Department fixture may return null if seed data not loaded
 * - Search and clear buttons may be absent in minimal UI
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { getSeedTeacherDepartmentFixture } from "../../../utils/e2e-db";
import { visibleText } from "../../../utils/locators";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/teachers", () => {
  test("contract", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/teachers", testInfo });
  });

  test("SSR output includes search params", async ({ baseURL }) => {
    const response = await fetch(
      absoluteTestUrl(
        `/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
        baseURL,
      ),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('id="main-content"');
    expect(html).toContain(DEV_SEED.teacher.nameCn);
  });

  test("mobile cards stay tappable and navigate to detail", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(
      page,
      `/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
      { testInfo, screenshotLabel: "teachers-list" },
    );

    const detailLink = page
      .locator("#main-content a[href^='/teachers/']:visible")
      .first();
    await expect(detailLink).toBeVisible();
    const box = await detailLink.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(250);
    await captureStepScreenshot(page, testInfo, "teachers-mobile-list");
    await detailLink.click();

    await expect(page).toHaveURL(/\/teachers\/\d+(?:\?.*)?$/);
    await expect(page.locator("#main-content")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "teachers-navigate-detail");
  });

  test("search and clear buttons work", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/teachers", {
      testInfo,
      screenshotLabel: "teachers",
    });

    const searchbox = page.getByRole("searchbox").first();
    await expect(searchbox).toBeVisible();

    await searchbox.fill(DEV_SEED.teacher.nameCn);
    const searchButton = page
      .getByRole("button", { name: /搜索|Search/i })
      .first();
    await expect(searchButton).toBeVisible();
    await searchButton.click();

    await expect(page).toHaveURL(/search=/);

    const clearLink = page.getByRole("link", { name: /清除|Clear/i }).first();
    await expect(clearLink).toBeVisible();
    await clearLink.click();
    await expect(page).not.toHaveURL(/search=/);

    await captureStepScreenshot(page, testInfo, "teachers-search-clear");
  });

  test("department filter preserves teacher results", async ({
    page,
  }, testInfo) => {
    const filter = await getSeedTeacherDepartmentFixture(DEV_SEED.teacher.code);
    await gotoAndWaitForReady(
      page,
      `/teachers?departmentId=${filter.departmentId ?? ""}`,
      { testInfo, screenshotLabel: "teachers-department" },
    );

    if (!filter.departmentName) {
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }

    await expect(page).toHaveURL(
      new RegExp(`departmentId=${filter.departmentId}`),
    );
    await expect(visibleText(page, DEV_SEED.teacher.nameCn)).toBeVisible();
    await captureStepScreenshot(page, testInfo, "teachers-filter-department");
  });
});
