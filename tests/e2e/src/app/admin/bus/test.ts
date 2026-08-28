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
 * - Non-admin → 403
 * - Seed version from DEV_SEED.bus always present
 */
import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { visibleText } from "../../../../utils/locators";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

test.describe.configure({ mode: "serial" });

test("/admin/bus 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/admin/bus");
  await captureStepScreenshot(page, testInfo, "admin-bus/unauthorized");
});

test("/admin/bus 普通用户访问返回 403", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/admin/bus", "/admin/bus");
  await expect(page.getByText("403").first()).toBeVisible();
  await expect(page.getByText("Forbidden").first()).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin-bus/403");
});

test("/admin/bus 显示所有必需的版本字段", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin/bus");

  // Heading
  await expect(visibleText(page, /Shuttle Bus|校车管理/)).toBeVisible();

  // version title (admin.yml bus-management.display.fields)
  await expect(visibleText(page, DEV_SEED.bus.versionTitle)).toBeVisible();
  // version key
  await expect(visibleText(page, DEV_SEED.bus.versionKey)).toBeVisible();
  // importedAt — date/time text (e.g. "2026-05-06 21:07")
  await expect(visibleText(page, /\d{4}-\d{2}-\d{2}/)).toBeVisible();
  // enabled status — "Active" in English, "启用" in Chinese
  await expect(visibleText(page, /Active|启用/i)).toBeVisible();

  await captureStepScreenshot(page, testInfo, "admin-bus/version-fields");
});

test("/admin/bus 版本表格包含班次数量", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin/bus");

  // tripCount — the page shows a plain number (e.g. "22") in the Trips column
  const tableCount = page.locator("table").getByText(/^\d+$/).first();
  await expect(tableCount).toBeVisible();

  await captureStepScreenshot(page, testInfo, "admin-bus/trip-count");
});

test("/admin/bus 主导航入口可见且可跳转", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin/users");

  const busLink = page
    .getByTestId("app-sidebar")
    .getByRole("link", { name: /校车管理|Bus Management/i });
  await expect(busLink).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/admin\/bus(?:\?.*)?$/),
    busLink.click(),
  ]);
  await captureStepScreenshot(
    page,
    testInfo,
    "admin-bus/navigate-from-sidebar",
  );
});

test("/admin/bus 激活版本受保护且导入弹窗可打开", async ({
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

  // The active seed version must never expose a destructive delete action.
  const deleteBtn = versionRow.getByRole("button", { name: /删除|Delete/i });
  await expect(deleteBtn).toHaveCount(0);

  const importBtn = page
    .getByRole("button", { name: /从 Static 导入|Import from Static/i })
    .first();
  await expect(importBtn).toBeVisible();
  await importBtn.click();
  const importDialog = page.getByRole("dialog", {
    name: /从 Static 导入|Import from Static/i,
  });
  await expect(importDialog).toBeVisible({ timeout: 5_000 });
  await captureStepScreenshot(page, testInfo, "admin-bus/import-dialog");
  await importDialog.getByRole("button", { name: /取消|Cancel/i }).click();
});

test("/admin/bus 激活非当前版本需要二次确认", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const version = await withE2ePrisma(async (prisma) => {
    const activeIds = (
      await prisma.busScheduleVersion.findMany({
        where: { isEnabled: true },
        select: { id: true },
      })
    ).map(({ id }) => id);
    const created = await prisma.busScheduleVersion.create({
      data: {
        checksum: `e2e-bus-checksum-${suffix}`,
        isEnabled: false,
        key: `e2e-bus-${suffix}`,
        rawJson: {},
        title: `E2E Bus ${suffix}`,
      },
    });
    return { activeIds, created };
  });

  try {
    await signInAsDevAdmin(page, "/admin/bus");
    const row = page
      .locator("tbody tr:visible")
      .filter({ hasText: version.created.key });
    const activateButton = row.getByRole("button", {
      name: /激活版本|Activate version/i,
    });
    await activateButton.click();
    const confirmDialog = page.getByRole("alertdialog", {
      name: /激活该时刻表版本|Activate timetable version/i,
    });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(version.created.key);
    await confirmDialog.getByRole("button", { name: /取消|Cancel/i }).click();
    await expect(confirmDialog).toBeHidden();

    await activateButton.click();
    const activateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/admin/bus") &&
        response.url().includes("activateVersion"),
    );
    await confirmDialog
      .getByRole("button", {
        name: /确认激活版本|Activate version/i,
      })
      .click();
    expect((await activateResponse).status()).toBe(200);
    await expect(row.getByText(/激活|Active/i)).toBeVisible();
  } finally {
    await withE2ePrisma(async (prisma) => {
      await prisma.$transaction([
        prisma.busScheduleVersion.updateMany({ data: { isEnabled: false } }),
        prisma.busScheduleVersion.updateMany({
          where: { id: { in: version.activeIds } },
          data: { isEnabled: true },
        }),
        prisma.busScheduleVersion.delete({ where: { id: version.created.id } }),
      ]);
    });
  }
});

test("/admin/bus 移动端首条版本操作可达", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsDevAdmin(page, "/admin/bus");

  const workspace = page.getByTestId("admin-workspace");
  const firstVersion = page
    .getByTestId("admin-bus-mobile-list")
    .locator("[data-slot='item']")
    .first();
  await expect(workspace).toBeVisible();
  await expect(workspace.locator("table")).toBeHidden();
  await expect(firstVersion).toBeVisible();
  await expect(firstVersion).toBeInViewport();

  await page
    .getByRole("button", { name: /从 Static 导入|Import from Static/i })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", {
      name: /从 Static 导入|Import from Static/i,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);

  await captureStepScreenshot(page, testInfo, "admin-bus/mobile-workspace");
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/admin/bus", testInfo });
});
