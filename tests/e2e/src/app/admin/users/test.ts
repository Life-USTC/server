import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import {
  createTempUsersFixture,
  deleteUsersByPrefix,
} from "../../../../utils/e2e-db";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe.configure({ mode: "serial" });

test("/admin/users 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/admin/users");
  await captureStepScreenshot(page, testInfo, "admin-users-unauthorized");
});

test("/admin/users 普通用户访问返回 404", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/admin/users", "/admin/users");
  await expect(page.locator("h1")).toHaveText("404");
  await captureStepScreenshot(page, testInfo, "admin-users-404");
});

test("/admin/users 管理员可看到 seed 用户", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin/users");

  await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(visibleText(page, DEV_SEED.debugUsername)).toBeVisible();
  await expect(visibleText(page, DEV_SEED.adminUsername)).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin-users-seed");
});

test("/admin/users 搜索表单可过滤用户", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin/users");

  await page.getByRole("searchbox").fill(DEV_SEED.debugUsername);
  await page.getByRole("button", { name: /搜索|Search/i }).click();

  await expect(page).toHaveURL(new RegExp(`search=${DEV_SEED.debugUsername}`));
  await expect(visibleText(page, DEV_SEED.debugUsername)).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin-users-search");

  const clearButton = page.getByRole("button", { name: /清除|Clear/i }).first();
  if ((await clearButton.count()) > 0) {
    await clearButton.click();
    await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
    await captureStepScreenshot(page, testInfo, "admin-users-clear");
  }
});

test("/admin/users 分页控件可进入下一页", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const prefix = `e2e-p-${Date.now().toString(36)}`;

  try {
    await createTempUsersFixture({ prefix, count: 21 });
    await signInAsDevAdmin(page, "/admin/users");

    const listResponse = await page.request.get("/api/admin/users");
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as {
      data?: Array<{ username?: string | null }>;
      pagination?: { totalPages?: number };
    };
    expect((listBody.pagination?.totalPages ?? 0) > 1).toBe(true);

    await gotoAndWaitForReady(page, "/admin/users?page=2");

    await expect(page).toHaveURL(/\/admin\/users\?page=2$/);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await captureStepScreenshot(page, testInfo, "admin-users-pagination");
  } finally {
    await deleteUsersByPrefix(prefix);
  }
});

test("/admin/users 用户名非法保存返回 400", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await signInAsDevAdmin(page, "/admin/users");

  const row = page
    .locator("tr:visible")
    .filter({ hasText: DEV_SEED.debugUsername })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();

  const dialog = page.getByRole("dialog", { name: /管理用户|Manage User/i });
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  const usernameInput = dialog.getByPlaceholder(/用户名|Username/i).first();
  await expect(usernameInput).toBeVisible();
  await usernameInput.fill("INVALID");

  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/users/") &&
      response.request().method() === "PATCH" &&
      response.status() === 400,
  );
  await dialog.getByRole("button", { name: /保存更改|Save/i }).click();
  await saveResponse;
  await captureStepScreenshot(page, testInfo, "admin-users-invalid-username");
});

test("/admin/users 可打开管理弹窗并保存姓名", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const prefix = `e2e-n-${Date.now().toString(36)}`;
  const { usernames } = await createTempUsersFixture({ prefix, count: 1 });

  try {
    await signInAsDevAdmin(page, "/admin/users");
    await gotoAndWaitForReady(
      page,
      `/admin/users?search=${encodeURIComponent(usernames[0] ?? prefix)}`,
    );

    const row = page
      .locator("tr:visible")
      .filter({ hasText: usernames[0] })
      .first();
    await expect(row).toBeVisible();
    await row.click();

    const dialog = page.getByRole("dialog", { name: /管理用户|Manage User/i });
    await expect(dialog).toBeVisible();

    const nameInput = dialog.getByPlaceholder(/姓名|Name/i).first();
    const newName = `e2e-${Date.now()}`;
    await nameInput.fill(newName);

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/users/") &&
        response.request().method() === "PATCH",
    );
    await dialog.getByRole("button", { name: /保存更改|Save/i }).click();
    const save = await saveResponse;
    expect(save.status()).toBe(200);
    await expect(dialog).toBeHidden();
    await captureStepScreenshot(page, testInfo, "admin-users-updated");

    await gotoAndWaitForReady(
      page,
      `/admin/users?search=${encodeURIComponent(usernames[0] ?? prefix)}`,
    );
    await expect(
      page.locator("tr:visible").filter({ hasText: newName }),
    ).toBeVisible();
  } finally {
    await deleteUsersByPrefix(prefix);
  }
});

test("/admin/users 自定义封禁时长会展示到期时间输入框", async ({
  page,
}, testInfo) => {
  const prefix = `e2e-cs-${Date.now().toString(36)}`;
  const { usernames } = await createTempUsersFixture({ prefix, count: 1 });

  try {
    await signInAsDevAdmin(page, "/admin/users");
    await gotoAndWaitForReady(
      page,
      `/admin/users?search=${encodeURIComponent(usernames[0] ?? prefix)}`,
    );

    const row = page
      .locator("tr:visible")
      .filter({ hasText: usernames[0] })
      .first();
    await expect(row).toBeVisible();
    await row.click();

    const dialog = page.getByRole("dialog", { name: /管理用户|Manage User/i });
    await expect(dialog).toBeVisible();

    const durationSelect = dialog.getByRole("button", {
      name: /封禁时长|Duration/i,
    });
    await expect(durationSelect).toBeVisible();
    await durationSelect.click();
    await page.getByRole("option", { name: /自定义|Custom/i }).click();

    const expiresAtInput = dialog.getByLabel(/到期时间|Expires At/i);
    await expect(expiresAtInput).toBeVisible();
    await expiresAtInput.fill("2030-01-01T00:00");
    await expect(expiresAtInput).toHaveValue("2030-01-01T00:00");

    const reason = `e2e-suspend-${Date.now()}`;
    const reasonInput = dialog.getByLabel(/原因|Reason/i);
    await expect(reasonInput).toBeVisible();
    await reasonInput.fill(reason);

    let suspendButton = dialog
      .getByRole("button", { name: /封禁|Suspend|Ban/i })
      .first();
    if ((await suspendButton.count()) === 0) {
      suspendButton = dialog.locator('button[class*="bg-destructive"]').first();
    }
    await expect(suspendButton).toBeVisible();
    await captureStepScreenshot(page, testInfo, "admin-users-suspended-custom");
  } finally {
    await deleteUsersByPrefix(prefix);
  }
});

test("/admin/users 可创建默认时长封禁并通过 API 解除", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const prefix = `e2e-s-${Date.now().toString(36)}`;
  const { usernames } = await createTempUsersFixture({ prefix, count: 1 });
  let suspensionId: string | undefined;

  try {
    await signInAsDevAdmin(page, "/admin/users");
    await gotoAndWaitForReady(
      page,
      `/admin/users?search=${encodeURIComponent(usernames[0] ?? prefix)}`,
    );

    const row = page
      .locator("tr:visible")
      .filter({ hasText: usernames[0] })
      .first();
    await expect(row).toBeVisible();
    await row.click();

    const dialog = page.getByRole("dialog", { name: /管理用户|Manage User/i });
    await expect(dialog).toBeVisible();

    const reason = `e2e-admin-users-suspend-${Date.now()}`;
    const reasonInput = dialog.getByLabel(/原因|Reason/i);
    await expect(reasonInput).toBeVisible();
    await reasonInput.fill(reason);

    let suspendButton = dialog
      .getByRole("button", { name: /封禁|Suspend|Ban/i })
      .first();
    if ((await suspendButton.count()) === 0) {
      suspendButton = dialog.locator('button[class*="bg-destructive"]').first();
    }
    await expect(suspendButton).toBeVisible();

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/suspensions") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await suspendButton.click({ force: true });
    const response = await responsePromise;
    const body = (await response.json()) as {
      suspension?: { id?: string; reason?: string | null };
    };
    expect(body.suspension?.reason).toBe(reason);
    expect(typeof body.suspension?.id).toBe("string");
    suspensionId = body.suspension?.id;
    await captureStepScreenshot(page, testInfo, "admin-users-suspend-created");

    const lift = await page.request.patch(
      `/api/admin/suspensions/${suspensionId}`,
    );
    expect(lift.status()).toBe(200);
    suspensionId = undefined;
  } finally {
    if (suspensionId) {
      await page.request.patch(`/api/admin/suspensions/${suspensionId}`);
    }
    await deleteUsersByPrefix(prefix);
  }
});
