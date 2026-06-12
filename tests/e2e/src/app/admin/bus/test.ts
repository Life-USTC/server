/**
 * E2E tests for /admin/bus — Bus Schedule Management
 *
 * ## Data Represented (admin.yml → bus-management.display.fields)
 * - Bus schedule version title
 * - version key
 * - tripCount
 * - importedAt
 * - effective range (effectiveFrom / effectiveUntil)
 * - enabled status
 * - Actions: import, activate, delete
 *
 * ## Features
 * - Admin home has "Bus Management" card linking to /admin/bus
 * - Version table with all required fields
 * - Import, activate, delete actions
 *
 * ## Edge Cases
 * - Unauthenticated → redirect to /signin
 * - Non-admin → 404
 * - Seed version from DEV_SEED.bus always present
 */
import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { visibleText } from "../../../../utils/locators";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test("/admin/bus 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/admin/bus");
  await captureStepScreenshot(page, testInfo, "admin-bus/unauthorized");
});

test("/admin/bus 普通用户访问返回 404", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/admin/bus", "/admin/bus");
  await expect(page.getByText("404").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
  ).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin-bus/404");
});

test("/admin/bus displays all required version fields", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin/bus");

  // Heading
  await expect(visibleText(page, /Versions|时刻表版本/)).toBeVisible();

  // version title (admin.yml bus-management.display.fields)
  await expect(visibleText(page, DEV_SEED.bus.versionTitle)).toBeVisible();
  // version key
  await expect(visibleText(page, DEV_SEED.bus.versionKey)).toBeVisible();
  // importedAt — date/time text (e.g. "2026-05-06 21:07")
  await expect(visibleText(page, /\d{4}-\d{2}-\d{2}/)).toBeVisible();
  // enabled status — "Active" in English, "启用" in Chinese
  await expect(visibleText(page, /Active|启用/i)).toBeVisible();
  await expect(visibleText(page, /Versions|时刻表版本/)).toBeVisible();
  await expect(visibleText(page, /Campuses|校区数/)).toBeVisible();
  await expect(visibleText(page, /Routes|路线数/)).toBeVisible();

  await captureStepScreenshot(page, testInfo, "admin-bus/version-fields");
});

test("/admin/bus version table has trip count", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin/bus");

  // tripCount — the page shows a plain number (e.g. "22") in the Trips column
  const tableCount = page.locator("table").getByText(/^\d+$/).first();
  await expect(tableCount).toBeVisible();

  await captureStepScreenshot(page, testInfo, "admin-bus/trip-count");
});

test("/admin/bus card visible on admin home and navigates", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin");

  const busCard = page.getByRole("link", {
    name: /校车管理|Shuttle Bus/i,
  });
  await expect(busCard).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/admin\/bus(?:\?.*)?$/),
    busCard.click(),
  ]);
  await captureStepScreenshot(page, testInfo, "admin-bus/navigate-from-home");
});

test("/admin/bus active version is protected and import dialog opens", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await signInAsDevAdmin(page, "/admin/bus");

  // Find seed version row
  const versionRow = page
    .locator("tr, [data-slot='card']")
    .filter({
      has: page.getByText(DEV_SEED.bus.versionKey),
    })
    .first();
  await expect(versionRow).toBeVisible();

  await expect(
    versionRow.getByRole("button", { name: /删除|Delete/i }),
  ).toHaveCount(0);

  const importBtn = page.getByRole("button", { name: /导入|Import/i }).first();
  await expect(importBtn).toBeVisible();
  await importBtn.click();
  const importDialog = page.getByRole("dialog", {
    name: /从 Static 导入|Import from Static/i,
  });
  await expect(importDialog).toBeVisible({ timeout: 5_000 });
  await captureStepScreenshot(page, testInfo, "admin-bus/import-dialog");
  await importDialog.getByRole("button", { name: /取消|Cancel/i }).click();
});
