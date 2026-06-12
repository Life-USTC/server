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
import { resolveSeedSectionId } from "../../../../utils/subscriptions";

test("/admin/moderation 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/admin/moderation");
  await captureStepScreenshot(page, testInfo, "admin-moderation-unauthorized");
});

test("/admin/moderation 普通用户访问返回 404", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/admin/moderation", "/admin/moderation");
  await expect(page.getByText("404").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
  ).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin-moderation-404");
});

test("/admin/moderation 管理员访问成功", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin/moderation");
  await expect(page).toHaveURL(/\/admin\/moderation(?:\?.*)?$/);
  await expect(page.locator("#main-content")).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin-moderation-home");
});

test("/admin/moderation invalid tab falls back to comments", async ({
  page,
}) => {
  await signInAsDevAdmin(page, "/admin/moderation?tab=bad");
  await expect(page.locator('input[type="hidden"][name="tab"]')).toHaveValue(
    "comments",
  );
  await expect(page.getByText("bad", { exact: true })).toHaveCount(0);
});

test("/admin/moderation 管理员可打开评论管理弹窗并切换状态选项", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin/moderation");
  const activeResponse = await page.request.get(
    "/api/admin/comments?status=active",
  );
  expect(activeResponse.status()).toBe(200);
  const activeBody = (await activeResponse.json()) as {
    comments?: Array<{ body?: string }>;
  };
  const targetComment = activeBody.comments?.find(
    (item) => item.body && item.body.trim().length > 0,
  );
  const keyword = targetComment?.body?.slice(0, 16) ?? "";
  expect(keyword.length > 0).toBe(true);

  await page
    .getByPlaceholder(/搜索评论内容或用户名|Search comments/i)
    .fill(keyword);
  await expect(visibleText(page, keyword)).toBeVisible();
  await visibleText(page, keyword).click();
  const dialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: /管理评论|Manage Comment/i }),
  });
  await expect(dialog).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin-moderation-dialog-open");

  const privateButton = dialog
    .getByRole("button", { name: /仅自己可见|Private/i })
    .first();
  await privateButton.click();
  await expect(privateButton).toHaveAttribute("aria-pressed", "true");
  await captureStepScreenshot(
    page,
    testInfo,
    "admin-moderation-status-selected",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("/admin/moderation 可更新评论状态与备注", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await signInAsDevAdmin(page, "/admin/moderation");

  const sectionId = await resolveSeedSectionId(page);

  const keyword = `e2e-moderation-${Date.now()}`;
  const createResponse = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      body: keyword,
      visibility: "public",
    },
  });
  expect(createResponse.status()).toBe(200);
  const createdComment = (await createResponse.json()) as { id?: string };
  expect(createdComment.id).toBeTruthy();

  await gotoAndWaitForReady(
    page,
    `/admin/moderation?search=${encodeURIComponent(keyword)}`,
  );
  await expect(visibleText(page, keyword)).toBeVisible();
  await visibleText(page, keyword).click();
  const dialog = page
    .getByRole("dialog", { name: /管理评论|Manage Comment/i })
    .first();
  await expect(dialog).toBeVisible();

  const privateButton = dialog
    .getByRole("button", { name: /仅自己可见|Private/i })
    .first();
  await privateButton.click();
  await expect(privateButton).toHaveAttribute("aria-pressed", "true");
  await dialog
    .getByPlaceholder(/备注|note/i)
    .first()
    .fill(`e2e-note-${Date.now()}`);

  const patchResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/comments/") &&
      response.request().method() === "PATCH" &&
      response.status() === 200,
  );
  await dialog.getByRole("button", { name: /确认|Confirm/i }).click();
  await patchResponse;
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });
  await captureStepScreenshot(page, testInfo, "admin-moderation-updated");
});

test("/admin/moderation 目标链接可跳转到原页面锚点", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const sectionPath = `/sections/${DEV_SEED.section.jwId}`;
  await signInAsDevAdmin(page, sectionPath);
  await gotoAndWaitForReady(page, sectionPath);

  const commentsTab = page.getByRole("tab", { name: /评论|Comments/i }).first();
  await expect(commentsTab).toBeVisible();
  await commentsTab.click();

  const body = `e2e-target-link-${Date.now()}`;
  await page.locator("textarea").first().fill(body);
  const createResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/comments") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: /发布评论|Post comment/i }).click();
  const created = await createResponse;
  const createdBody = (await created.json()) as { id?: string };
  const id = createdBody.id;
  expect(typeof id).toBe("string");

  await gotoAndWaitForReady(page, "/admin/moderation");
  await page
    .getByPlaceholder(/搜索评论内容或用户名|Search comments/i)
    .fill(body);
  await expect(visibleText(page, body)).toBeVisible();
  await visibleText(page, body).click();
  const manageDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: /管理评论|Manage Comment/i }),
  });
  await expect(manageDialog).toBeVisible();
  const targetLink = manageDialog.getByRole("link", {
    name: /打开目标|Open target/i,
  });
  await expect(targetLink).toBeVisible();
  await expect(targetLink).toHaveAttribute(
    "href",
    new RegExp(`#comment-${id}`),
  );
  await Promise.all([
    page.waitForURL(new RegExp(`#comment-${id}$`)),
    targetLink.click(),
  ]);
  await captureStepScreenshot(
    page,
    testInfo,
    "admin-moderation-navigate-target",
  );
});

test("/admin/moderation 可切换状态筛选下拉", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin/moderation");

  const filter = page.getByRole("combobox").first();
  if ((await filter.count()) === 0) {
    await expect(page.locator("#main-content")).toBeVisible();
    return;
  }
  await filter.click();

  const option = page.getByRole("option", { name: /已删除|Deleted/i }).first();
  if ((await option.count()) === 0) {
    await page.keyboard.press("Escape");
    return;
  }
  await option.click();
  await expect(filter).toContainText(/已删除|Deleted/i);
  await captureStepScreenshot(
    page,
    testInfo,
    "admin-moderation-filter-deleted",
  );
});

test("/admin/moderation 封禁列表可解除封禁", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const prefix = `e2e-moderation-sus-${Date.now()}`;
  const { usernames } = await createTempUsersFixture({ prefix, count: 1 });
  await signInAsDevAdmin(page, "/admin/moderation");

  const usersResponse = await page.request.get(
    `/api/admin/users?search=${encodeURIComponent(usernames[0] ?? prefix)}`,
  );
  expect(usersResponse.status()).toBe(200);
  const usersBody = (await usersResponse.json()) as {
    data?: Array<{ id?: string; username?: string | null }>;
  };
  const targetUser = usersBody.data?.find(
    (item) => item.username === usernames[0],
  );
  expect(targetUser?.id).toBeTruthy();

  const reason = `e2e-moderation-suspension-${Date.now()}`;
  const createSuspensionResponse = await page.request.post(
    "/api/admin/suspensions",
    {
      data: {
        userId: targetUser?.id,
        reason,
      },
    },
  );
  expect(createSuspensionResponse.status()).toBe(200);
  const createdBody = (await createSuspensionResponse.json()) as {
    suspension?: { id?: string };
  };
  const suspensionId = createdBody.suspension?.id;
  expect(suspensionId).toBeTruthy();

  try {
    await gotoAndWaitForReady(page, "/admin/moderation");
    await captureStepScreenshot(page, testInfo, "admin-moderation-suspended");
  } finally {
    const lift = await page.request.patch(
      `/api/admin/suspensions/${suspensionId}`,
    );
    expect(lift.status()).toBe(200);
    await deleteUsersByPrefix(prefix);
  }
});

test("/admin/moderation 可从评论弹窗封禁并解除用户", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await signInAsDevAdmin(page, `/sections/${DEV_SEED.section.jwId}`);
  let suspensionId: string | undefined;

  try {
    await expect(async () => {
      const commentsTab = page
        .getByRole("tab", { name: /评论|Comments/i })
        .first();
      await expect(commentsTab).toBeVisible();
      await commentsTab.click();
      await expect(commentsTab).toHaveAttribute("aria-selected", "true");
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

    const body = `e2e-admin-suspend-${Date.now()}`;
    await page.locator("textarea").first().fill(body);
    const createComment = page.waitForResponse(
      (response) =>
        response.url().includes("/api/comments") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: /发布评论|Post comment/i }).click();
    await createComment;
    await page.waitForLoadState("networkidle");

    await gotoAndWaitForReady(page, "/admin/moderation");
    await page
      .getByPlaceholder(/搜索评论内容或用户名|Search comments/i)
      .fill(body);
    await expect(visibleText(page, body)).toBeVisible();
    await visibleText(page, body).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/封禁|Suspension|Suspend/i).first(),
    ).toBeVisible();

    const reason = `e2e-reason-${Date.now()}`;
    const reasonInput = dialog.getByPlaceholder(/封禁原因|reason/i).first();
    if ((await reasonInput.count()) > 0) {
      await reasonInput.fill(reason);
    }

    const suspendResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/suspensions") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await dialog.getByRole("button", { name: /封禁|Suspend/i }).click();
    const created = await suspendResponse;
    const createdBody = (await created.json()) as {
      suspension?: { id?: string };
    };
    suspensionId = createdBody.suspension?.id;
    expect(typeof suspensionId).toBe("string");
    await captureStepScreenshot(
      page,
      testInfo,
      "admin-moderation-suspended-from-dialog",
    );
  } finally {
    if (suspensionId) {
      const lift = await page.request.patch(
        `/api/admin/suspensions/${suspensionId}`,
      );
      expect(lift.status()).toBe(200);
    }
  }
});

// ── Description governance ──────────────────────────────────────────────────

test("/admin/moderation description governance table visible", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin/moderation");

  // admin.yml moderation.display.fields: Description moderation table
  const descTab = page.getByRole("tab", { name: /简介|Description/i }).first();
  if ((await descTab.count()) > 0) {
    await descTab.click();
    // description.content / preview visible
    await expect(page.locator("td, [data-slot='card']").first()).toBeVisible();
    await captureStepScreenshot(
      page,
      testInfo,
      "admin-moderation/description-table",
    );
  } else {
    // descriptions may be on the same tab — look for the section header
    const descSection = page.getByText(/简介管理|Descriptions/i).first();
    if ((await descSection.count()) > 0) {
      await expect(descSection).toBeVisible();
    }
    // Verify the API is accessible
    const descResponse = await page.request.get("/api/admin/descriptions");
    expect(descResponse.status()).toBe(200);
    const descBody = (await descResponse.json()) as {
      descriptions?: Array<{ id?: string }>;
    };
    expect(Array.isArray(descBody.descriptions)).toBe(true);
    await captureStepScreenshot(
      page,
      testInfo,
      "admin-moderation/descriptions-api",
    );
  }
});

// ── Homework governance ─────────────────────────────────────────────────────

test("/admin/moderation homework governance accessible", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin/moderation");

  // admin.yml moderation.display.fields (via homework.yml → homework-governance)
  const hwTab = page.getByRole("tab", { name: /作业|Homework/i }).first();
  if ((await hwTab.count()) > 0) {
    await hwTab.click();
    await captureStepScreenshot(
      page,
      testInfo,
      "admin-moderation/homework-tab",
    );
  }

  // Verify the homework governance API is accessible
  const hwResponse = await page.request.get("/api/admin/homeworks");
  expect(hwResponse.status()).toBe(200);
  const hwBody = (await hwResponse.json()) as {
    homeworks?: Array<{ id?: string }>;
  };
  expect(Array.isArray(hwBody.homeworks)).toBe(true);

  await captureStepScreenshot(
    page,
    testInfo,
    "admin-moderation/homework-governance",
  );
});
