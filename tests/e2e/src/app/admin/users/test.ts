import { expect, type Page } from "@playwright/test";
import type { User } from "../../../../../../src/generated/prisma-node/client";
import {
  test as adminTest,
  adminWriteChecks,
} from "../../../../utils/admin-fixture";
import { expectRequiresSignIn } from "../../../../utils/auth";
import { visibleText } from "../../../../utils/locators";
import { observeAction } from "../../../../utils/observed-action";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

const test = adminTest.extend<{ managedUser: User & { username: string } }>({
  managedUser: async ({ isolatedWorker, admin: _admin, run }, use) => {
    const managed = await run(async () => {
      const marker = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
      const user = await isolatedWorker.database.owner.user.create({
        data: {
          name: "Independent managed user",
          username: `managed${marker}`,
          email: `${marker}@managed-user.test`,
          emailVerified: true,
        },
      });
      if (!user.username)
        throw new Error("The managed user must have a username");
      return { ...user, username: user.username };
    });
    await use(managed);
  },
});

function adminUserTableRow(page: Page, text: string) {
  return page.locator("tbody tr:visible").filter({ hasText: text }).first();
}

async function openAdminUserDialog(
  page: Page,
  text: string,
  activation: "click" | "keyboard" = "click",
) {
  const row = adminUserTableRow(page, text);
  await expect(row).toBeVisible({ timeout: 10_000 });
  const manageButton = row
    .getByRole("button", { name: /管理用户|Manage User/i })
    .first();
  await expect(manageButton).toBeVisible({ timeout: 10_000 });

  if (activation === "keyboard") {
    await manageButton.focus();
    await expect(manageButton).toBeFocused();
    await page.keyboard.press("Enter");
  } else {
    await manageButton.click();
  }

  const dialog = page.getByRole("dialog", { name: /管理用户|Manage User/i });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

test("/admin/users 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/admin/users");
  await captureStepScreenshot(page, testInfo, "admin-users-unauthorized");
});

test("/admin/users 普通用户访问返回 403", async ({
  pageRun,
  page,
  account: _account,
}, testInfo) => {
  await pageRun(
    async () => {
      await gotoAndWaitForReady(page, "/admin/users");
      await expect(page.locator("h1")).toHaveText("403");
      await captureStepScreenshot(page, testInfo, "admin-users-403");
    },
    async () => {
      throw new Error("Read-only authorization case submitted a browser write");
    },
  );
});

test("/admin/users 管理员可看到独立用户与管理员", async ({
  adminFlow,
  run,
  page,
  managedUser,
  admin,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(page, "/admin/users");

        await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
        await expect(page.locator("#main-content")).toBeVisible();
        await expect(visibleText(page, managedUser.username)).toBeVisible();
        await expect(visibleText(page, admin.username)).toBeVisible();
        await captureStepScreenshot(page, testInfo, "admin-users-seed");
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/users 桌面行操作可用键盘打开管理弹窗", async ({
  adminFlow,
  run,
  page,
  managedUser,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(page, "/admin/users");

        await openAdminUserDialog(page, managedUser.username, "keyboard");
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-users-keyboard-manage",
        );
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/users 变更管理员权限需要二次确认", async ({
  adminFlow,
  run,
  page,
  managedUser,
  isolatedWorker,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(page, "/admin/users");

        const dialog = await openAdminUserDialog(page, managedUser.username);
        const adminCheckbox = dialog.getByRole("checkbox", {
          name: /设为管理员|Grant admin access/i,
        });
        await adminCheckbox.check();
        await dialog.getByRole("button", { name: /保存更改|Save/i }).click();

        const confirmDialog = page.getByRole("alertdialog", {
          name: /变更管理员权限|Change administrator access/i,
        });
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog).toContainText(
          /访问全部管理与审核工具|access to all administration and moderation tools/i,
        );
        await confirmDialog
          .getByRole("button", { name: /取消|Cancel/i })
          .click();
        await expect(confirmDialog).toBeHidden();
        await expect(dialog).toBeVisible();
        expect(
          await isolatedWorker.database.owner.user.findUniqueOrThrow({
            where: { id: managedUser.id },
          }),
        ).toMatchObject({ isAdmin: false });
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/users 搜索表单可过滤用户", async ({
  adminFlow,
  run,
  page,
  managedUser,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(page, "/admin/users");

        await page.getByRole("searchbox").fill(managedUser.username);
        await page
          .getByTestId("admin-workspace")
          .getByRole("button", { name: /^(搜索|Search)$/ })
          .click();

        await expect(page).toHaveURL(
          new RegExp(`search=${managedUser.username}`),
        );
        await expect(visibleText(page, managedUser.username)).toBeVisible();
        await captureStepScreenshot(page, testInfo, "admin-users-search");

        const clearLink = page.getByRole("link", { name: /^(清除|Clear)$/i });
        await expect(clearLink).toHaveAttribute("href", "/admin/users");
        await clearLink.click();
        await expect(page).toHaveURL(/\/admin\/users$/);
        await expect(page.getByRole("searchbox")).toHaveValue("");
        await captureStepScreenshot(page, testInfo, "admin-users-clear");
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/users 移动端工作区可搜索并管理首条记录", async ({
  adminFlow,
  run,
  page,
  managedUser,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoAndWaitForReady(page, "/admin/users");

        const workspace = page.getByTestId("admin-workspace");
        await expect(workspace).toBeVisible();
        await expect(workspace.locator("table")).toBeHidden();
        await page.getByRole("searchbox").fill(managedUser.username);
        await workspace
          .getByRole("button", { name: /^(搜索|Search)$/ })
          .click();

        const record = page
          .getByTestId("admin-users-mobile-list")
          .locator('[data-slot="item"]')
          .filter({ hasText: managedUser.username })
          .first();
        await expect(record).toBeVisible();
        await expect(record).toBeInViewport();
        await record
          .getByRole("button", { name: /管理用户|Manage User/i })
          .click();
        const dialog = page.getByRole("dialog", {
          name: /管理用户|Manage User/i,
        });
        await expect(dialog).toBeVisible();
        await expect(
          dialog.locator('[data-slot="dialog-close"]'),
        ).toBeVisible();
        const footerButtons = dialog.locator(
          '[data-slot="dialog-footer"] button',
        );
        await expect(footerButtons).toHaveCount(2);
        await expect(footerButtons.nth(0)).toContainText(/取消|Cancel/i);
        await expect(footerButtons.nth(1)).toContainText(/保存更改|Save/i);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(390);

        // Reflow the same dialog at the narrowest supported mobile width.
        await page.setViewportSize({ width: 320, height: 844 });
        await expect(dialog).toBeVisible();
        await expect(
          dialog.locator('[data-slot="dialog-close"]'),
        ).toBeVisible();
        await expect(footerButtons.nth(0)).toBeVisible();
        await expect(footerButtons.nth(1)).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(320);
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-users-mobile-dialog",
        );
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/users 状态列对齐且平板使用可读列表", async ({
  adminFlow,
  run,
  page,
  managedUser,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await gotoAndWaitForReady(page, "/admin/users");

        const table = page.locator("table:visible");
        const headers = table.locator("thead th");
        const firstRowCells = adminUserTableRow(
          page,
          managedUser.username,
        ).locator("td");
        await expect(table).toBeVisible();
        expect(
          await headers
            .nth(3)
            .evaluate((node) => getComputedStyle(node).textAlign),
        ).toBe("center");
        expect(
          await headers
            .nth(4)
            .evaluate((node) => getComputedStyle(node).textAlign),
        ).toBe("center");
        expect(
          await headers
            .nth(5)
            .evaluate((node) => getComputedStyle(node).textAlign),
        ).toBe("right");
        expect(
          await firstRowCells
            .nth(4)
            .evaluate((node) => getComputedStyle(node).textAlign),
        ).toBe("center");
        expect(
          await firstRowCells
            .nth(5)
            .evaluate((node) => getComputedStyle(node).textAlign),
        ).toBe("right");
        const suspensionCell = firstRowCells.nth(4);
        const suspensionBadge = suspensionCell.locator('[data-slot="badge"]');
        const secondaryPlaceholder = suspensionCell.locator(
          '[data-slot="truncated-text-placeholder"]',
        );
        await expect(secondaryPlaceholder).toHaveCount(1);
        await expect(secondaryPlaceholder).toHaveAttribute(
          "aria-hidden",
          "true",
        );
        await expect(secondaryPlaceholder).toHaveText("");
        expect(
          await secondaryPlaceholder.evaluate(
            (node) => node.getBoundingClientRect().height,
          ),
        ).toBeGreaterThan(0);
        const verticalCenterOffset = await suspensionCell.evaluate((cell) => {
          const group = cell.firstElementChild;
          if (!group) return Number.POSITIVE_INFINITY;
          const cellRect = cell.getBoundingClientRect();
          const groupRect = group.getBoundingClientRect();
          return Math.abs(
            groupRect.top +
              groupRect.height / 2 -
              (cellRect.top + cellRect.height / 2),
          );
        });
        await expect(suspensionBadge).toBeVisible();
        expect(verticalCenterOffset).toBeLessThanOrEqual(1);
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-users-alignment-desktop",
        );

        await page.setViewportSize({ width: 1024, height: 768 });
        await expect(table).toBeHidden();
        const list = page.getByTestId("admin-users-mobile-list");
        await expect(list).toBeVisible();
        const metadataColumns = list
          .locator('[data-slot="item"]')
          .filter({ hasText: managedUser.username })
          .locator("dl")
          .locator(":scope > div");
        expect(["left", "start"]).toContain(
          await metadataColumns
            .nth(0)
            .evaluate((node) => getComputedStyle(node).textAlign),
        );
        expect(
          await metadataColumns
            .nth(1)
            .evaluate((node) => getComputedStyle(node).textAlign),
        ).toBe("right");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(1024);

        await captureStepScreenshot(
          page,
          testInfo,
          "admin-users-alignment-tablet",
        );
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/users 分页控件可进入下一页", async ({
  adminFlow,
  run,
  page,
  managedUser,
  isolatedWorker,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        test.setTimeout(60000);
        const prefix = managedUser.username;
        await isolatedWorker.database.owner.user.createMany({
          data: Array.from({ length: 20 }, (_, index) => ({
            name: `Pagination user ${index}`,
            username: `p${crypto.randomUUID().replaceAll("-", "").slice(0, 19)}`,
            email: `${prefix}-${index}@pagination.test`,
          })),
        });
        await gotoAndWaitForReady(page, `/admin/users?search=${prefix}`);

        const pagination = page.locator('[data-slot="list-pagination"]');
        const nextPage = pagination.getByRole("link", {
          name: /下一页|Next page/i,
        });
        await expect(nextPage).toHaveAttribute(
          "href",
          new RegExp(`search=${prefix}`),
        );
        await expect(nextPage).toHaveAttribute("href", /page=2/);
        await nextPage.click();
        await expect(page).toHaveURL(/page=2/);
        expect(new URL(page.url()).searchParams.get("search")).toBe(prefix);
        await expect(page.getByRole("searchbox")).toHaveValue(prefix);
        await expect(page.locator("tbody tr").first()).toBeVisible();
        await expect(pagination.locator('[aria-current="page"]')).toHaveText(
          "2",
        );
        await pagination
          .getByRole("link", { name: /上一页|Previous page/i })
          .click();
        await expect(pagination.locator('[aria-current="page"]')).toHaveText(
          "1",
        );
        expect(new URL(page.url()).searchParams.get("search")).toBe(prefix);
        await captureStepScreenshot(page, testInfo, "admin-users-pagination");
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/users 用户名非法保存返回 400", async ({
  adminFlow,
  run,
  page,
  managedUser,
  isolatedWorker,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        test.setTimeout(60000);
        await gotoAndWaitForReady(page, "/admin/users");

        const dialog = await openAdminUserDialog(page, managedUser.username);

        const usernameInput = dialog.getByLabel(/ID/i).first();
        await expect(usernameInput).toBeVisible();
        await usernameInput.fill("INVALID");

        const saveResponse = observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response.url().includes("/api/admin/users/") &&
                response.request().method() === "PATCH" &&
                response.status() === 400,
            ),
          () => dialog.getByRole("button", { name: /保存更改|Save/i }).click(),
        );
        await saveResponse;
        expect(
          await isolatedWorker.database.owner.user.findUniqueOrThrow({
            where: { id: managedUser.id },
          }),
        ).toMatchObject({ username: managedUser.username });
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-users-invalid-username",
        );
      },
      {},
      adminWriteChecks([["PATCH", `/api/admin/users/${managedUser.id}`, 400]]),
    ),
  );
});

test("/admin/users 可打开管理弹窗并保存姓名", async ({
  adminFlow,
  run,
  page,
  managedUser,
  isolatedWorker,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        test.setTimeout(60000);

        await gotoAndWaitForReady(page, "/admin/users");
        await gotoAndWaitForReady(
          page,
          `/admin/users?search=${encodeURIComponent(managedUser.username)}`,
        );

        const dialog = await openAdminUserDialog(page, managedUser.username);

        const nameInput = dialog.getByLabel(/昵称|Nickname/i).first();
        const newName = `e2e-${Date.now()}`;
        await nameInput.fill(newName);

        const saveResponse = observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response.url().includes("/api/admin/users/") &&
                response.request().method() === "PATCH",
            ),
          () => dialog.getByRole("button", { name: /保存更改|Save/i }).click(),
        );
        const save = await saveResponse;
        expect(save.status()).toBe(200);
        expect(
          await isolatedWorker.database.owner.user.findUniqueOrThrow({
            where: { id: managedUser.id },
          }),
        ).toMatchObject({ name: newName });
        await expect(dialog).toBeHidden();
        await expect(
          page
            .locator("[data-sonner-toast]")
            .filter({ hasText: /更新成功|Updated successfully/i }),
        ).toBeVisible();
        await captureStepScreenshot(page, testInfo, "admin-users-updated");

        await gotoAndWaitForReady(
          page,
          `/admin/users?search=${encodeURIComponent(managedUser.username)}`,
        );
        await expect(
          page.locator("tr:visible").filter({ hasText: newName }),
        ).toBeVisible();
      },
      { auditActions: { admin_user_profile_update: 1 } },
      adminWriteChecks([["PATCH", `/api/admin/users/${managedUser.id}`, 200]]),
    ),
  );
});

test("/admin/users 自定义封禁时长会展示到期时间输入框", async ({
  adminFlow,
  run,
  page,
  managedUser,
  isolatedWorker,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(page, "/admin/users");
        await gotoAndWaitForReady(
          page,
          `/admin/users?search=${encodeURIComponent(managedUser.username)}`,
        );

        const dialog = await openAdminUserDialog(page, managedUser.username);

        const durationSelect = dialog.getByRole("combobox", {
          name: /封禁时长|Duration/i,
        });
        await expect(durationSelect).toBeVisible();
        await durationSelect.selectOption("custom");
        await expect(durationSelect).toHaveValue("custom");

        const expiresAtInput = dialog.getByRole("textbox", {
          name: /到期时间|Expires At/i,
        });
        await expect(expiresAtInput).toBeVisible();
        await expiresAtInput.fill("2030-01-01T00:00");
        await expect(expiresAtInput).toHaveValue("2030-01-01T00:00");

        const reason = `e2e-suspend-${Date.now()}`;
        const reasonInput = dialog.getByLabel(/原因|Reason/i);
        await expect(reasonInput).toBeVisible();
        await reasonInput.fill(reason);

        const suspendButton = dialog
          .getByRole("button", { name: /封禁|Suspend|Ban/i })
          .first();
        await expect(suspendButton).toBeVisible();
        expect(
          await isolatedWorker.database.owner.userSuspension.count({
            where: { userId: managedUser.id },
          }),
        ).toBe(0);
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-users-suspended-custom",
        );
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/users 可创建默认时长封禁", async ({
  adminFlow,
  run,
  page,
  managedUser,
  admin,
  isolatedWorker,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        test.setTimeout(60000);

        await gotoAndWaitForReady(page, "/admin/users");
        await gotoAndWaitForReady(
          page,
          `/admin/users?search=${encodeURIComponent(managedUser.username)}`,
        );

        const dialog = await openAdminUserDialog(page, managedUser.username);

        const reason = `e2e-admin-users-suspend-${Date.now()}`;
        const reasonInput = dialog.getByLabel(/原因|Reason/i);
        await expect(reasonInput).toBeVisible();
        await reasonInput.fill(reason);

        const suspendButton = dialog
          .getByRole("button", { name: /封禁|Suspend|Ban/i })
          .first();
        await expect(suspendButton).toBeVisible();

        const responsePromise = observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response.url().includes("/api/admin/suspensions") &&
                response.request().method() === "POST" &&
                response.status() === 201,
            ),
          () => suspendButton.click(),
        );
        const response = await responsePromise;
        const body = (await response.json()) as {
          suspension?: { id?: string; reason?: string | null };
        };
        expect(body.suspension?.reason).toBe(reason);
        expect(typeof body.suspension?.id).toBe("string");
        const suspensionId = body.suspension?.id;
        expect(
          await isolatedWorker.database.owner.userSuspension.findMany({
            where: { userId: managedUser.id },
          }),
        ).toEqual([
          expect.objectContaining({
            id: suspensionId,
            createdById: admin.id,
            reason,
            liftedAt: null,
          }),
        ]);
        await expect(
          page
            .locator("[data-sonner-toast]")
            .filter({ hasText: /封禁成功|Suspended successfully/i }),
        ).toBeVisible();
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-users-suspend-created",
        );

        await gotoAndWaitForReady(
          page,
          `/admin/users?search=${encodeURIComponent(managedUser.username)}`,
        );
        const suspendedDialog = await openAdminUserDialog(
          page,
          managedUser.username,
        );
        await suspendedDialog
          .getByRole("button", { name: /更新封禁|Update suspension/i })
          .click();
        const updateDialog = page.getByRole("alertdialog", {
          name: /替换当前封禁|Replace the active suspension/i,
        });
        await expect(updateDialog).toContainText(
          /使用新的原因与到期时间创建替代记录|replaced with the new reason and expiration/i,
        );
        await updateDialog
          .getByRole("button", { name: /取消|Cancel/i })
          .click();
        await expect(updateDialog).toBeHidden();
        expect(
          await isolatedWorker.database.owner.userSuspension.findMany({
            where: { userId: managedUser.id },
          }),
        ).toEqual([
          expect.objectContaining({
            id: suspensionId,
            createdById: admin.id,
            reason,
            liftedAt: null,
          }),
        ]);
      },
      { auditActions: { admin_user_suspend: 1 } },
      adminWriteChecks([["POST", "/api/admin/suspensions", 201]]),
    ),
  );
});

test("页面契约", async ({ adminFlow, run, page, admin: _admin }, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        const response = await gotoAndWaitForReady(page, "/admin/users", {
          browserHealth: {},
          expectMeaningfulContent: true,
          expectNoHorizontalOverflow: true,
          uiQuality: {},
          testInfo,
        });
        expect(response?.ok()).toBe(true);
        await expect(page.locator("#main-content")).toBeVisible();
        await expect(
          page.getByRole("heading", {
            name: /用户管理|User Management|用户列表|Users/i,
          }),
        ).toBeVisible();
        await expect(
          page.locator("table, [role='table'], [data-slot='table']"),
        ).toBeVisible();
      },
      {},
      adminWriteChecks([]),
    ),
  );
});
