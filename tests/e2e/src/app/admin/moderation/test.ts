import { expect, type Page } from "@playwright/test";
import { adminWriteChecks } from "../../../../utils/admin-fixture";
import { expectRequiresSignIn } from "../../../../utils/auth";
import { openCommentComposer } from "../../../../utils/comments";
import { visibleText } from "../../../../utils/locators";
import { test } from "../../../../utils/moderation-fixture";
import { observeAction } from "../../../../utils/observed-action";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

function moderationTableRow(page: Page, text: string) {
  return page.locator("tbody tr:visible").filter({ hasText: text }).first();
}

async function openModerationCommentDialog(
  page: Page,
  text: string,
  activation: "click" | "keyboard" = "click",
) {
  const row = moderationTableRow(page, text);
  await expect(row).toBeVisible({ timeout: 10_000 });
  const manageButton = row
    .getByRole("button", { name: /管理评论|Manage Comment/i })
    .first();
  await expect(manageButton).toBeVisible({ timeout: 10_000 });

  if (activation === "keyboard") {
    await manageButton.focus();
    await expect(manageButton).toBeFocused();
    await page.keyboard.press("Enter");
  } else {
    await manageButton.click();
  }

  const dialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: /管理评论|Manage Comment/i }),
  });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

async function openModerationDescriptionDialog(
  page: Page,
  text: string,
  activation: "click" | "keyboard" = "click",
) {
  const row = moderationTableRow(page, text);
  await expect(row).toBeVisible({ timeout: 10_000 });
  const manageButton = row
    .getByRole("button", { name: /管理课程简介|Manage Description/i })
    .first();
  await expect(manageButton).toBeVisible({ timeout: 10_000 });

  if (activation === "keyboard") {
    await manageButton.focus();
    await expect(manageButton).toBeFocused();
    await page.keyboard.press("Enter");
  } else {
    await manageButton.click();
  }

  const dialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", {
      name: /管理课程简介|Manage Description/i,
    }),
  });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

test("/admin/moderation 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/admin/moderation");
  await captureStepScreenshot(page, testInfo, "admin-moderation-unauthorized");
});

test("/admin/moderation 普通用户访问返回 403", async ({
  pageRun,
  page,
  account: _account,
}, testInfo) => {
  await pageRun(
    async () => {
      await gotoAndWaitForReady(page, "/admin/moderation");
      await expect(page.getByText("403").first()).toBeVisible();
      await expect(page.getByText("Forbidden").first()).toBeVisible();
      await captureStepScreenshot(page, testInfo, "admin-moderation-403");
    },
    async () => {
      throw new Error("Read-only authorization case submitted a browser write");
    },
  );
});

test("/admin/moderation 管理员访问成功", async ({
  adminFlow,
  run,
  page,
  moderation: _moderation,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(page, "/admin/moderation");
        await expect(page).toHaveURL(/\/admin\/moderation(?:\?.*)?$/);
        await expect(page.locator("#main-content")).toBeVisible();
        await page.keyboard.press("ControlOrMeta+Shift+K");
        await expect(page.getByRole("searchbox")).toBeFocused();
        await captureStepScreenshot(page, testInfo, "admin-moderation-home");
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/moderation 刷新队列并保留当前视图", async ({
  adminFlow,
  run,
  page,
  moderation: _moderation,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(page, "/admin/moderation?tab=descriptions");
        const refreshButton = page.getByRole("button", {
          name: /刷新队列|Refresh queue/i,
        });
        await expect(refreshButton).toBeVisible();
        await expect(refreshButton).toBeEnabled();

        const refreshResponse = observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response.request().method() === "GET" &&
                response.url().includes("/admin/moderation") &&
                response.url().includes("__data.json"),
            ),
          () => refreshButton.click(),
        );
        await expect((await refreshResponse).status()).toBe(200);

        await expect(page).toHaveURL(/\/admin\/moderation\?tab=descriptions$/);
        await expect(refreshButton).toBeVisible();
        await expect(refreshButton).toBeEnabled();
        await expect(
          page.getByRole("link", { name: /课程简介|Descriptions/i }),
        ).toHaveAttribute("aria-current", "page");
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/moderation 无效标签回退到评论", async ({
  adminFlow,
  run,
  page,
  moderation: _moderation,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(page, "/admin/moderation?tab=bad");
        await expect(
          page.locator('input[type="hidden"][name="tab"]'),
        ).toHaveValue("comments");
        await expect(page.getByText("bad", { exact: true })).toHaveCount(0);
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/moderation 移动端工作区可管理首条筛选结果", async ({
  adminFlow,
  run,
  page,
  moderation,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoAndWaitForReady(page, "/admin/moderation");
        const keyword = moderation.comment.body;

        await page
          .getByPlaceholder(/搜索评论内容或 ID|Search comment content or ID/i)
          .fill(keyword);
        const record = page
          .getByTestId("admin-moderation-mobile-list")
          .locator('[data-slot="item"]')
          .filter({ hasText: keyword })
          .first();
        await expect(record).toBeVisible();
        await expect(
          page.getByTestId("admin-workspace").locator("table"),
        ).toBeHidden();
        await record
          .getByRole("button", { name: /管理评论|Manage Comment/i })
          .click();
        await expect(
          page.getByRole("dialog").filter({
            has: page.getByRole("heading", {
              name: /管理评论|Manage Comment/i,
            }),
          }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(390);

        await captureStepScreenshot(
          page,
          testInfo,
          "admin-moderation-mobile-workspace",
        );
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/moderation 移动端弹窗滚动体不遮挡封禁控件", async ({
  adminFlow,
  run,
  page,
  moderation,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        const viewports = [
          { width: 320, height: 568 },
          { width: 320, height: 800 },
        ] as const;
        await page.setViewportSize(viewports[0]);
        await gotoAndWaitForReady(page, "/admin/moderation");

        const keyword = moderation.comment.body;

        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await gotoAndWaitForReady(
            page,
            `/admin/moderation?search=${encodeURIComponent(keyword)}`,
          );
          await page
            .getByPlaceholder(/搜索评论内容或 ID|Search comment content or ID/i)
            .fill(keyword);

          const record = page
            .getByTestId("admin-moderation-mobile-list")
            .locator('[data-slot="item"]')
            .filter({ hasText: keyword })
            .first();
          await expect(record).toBeVisible();
          await record
            .getByRole("button", { name: /管理评论|Manage Comment/i })
            .click();

          const dialog = page.getByRole("dialog").filter({
            has: page.getByRole("heading", {
              name: /管理评论|Manage Comment/i,
            }),
          });
          await expect(dialog).toBeVisible();
          await expect(
            dialog.getByRole("button", { name: /取消|Cancel/i }),
          ).toHaveCount(1);
          await expect(
            dialog.locator('[data-slot="dialog-close"]'),
          ).toHaveCount(0);

          const suspendButton = dialog.getByRole("button", {
            name: /^(封禁|Suspend)$/i,
          });
          await suspendButton.scrollIntoViewIfNeeded();
          const reasonInput = dialog.locator("#moderation-suspension-reason");
          await reasonInput.scrollIntoViewIfNeeded();
          const [footerBox, reasonBox, suspendBox] = await Promise.all([
            dialog.locator('[data-slot="dialog-footer"]').boundingBox(),
            reasonInput.boundingBox(),
            suspendButton.boundingBox(),
          ]);
          expect(footerBox).not.toBeNull();
          expect(reasonBox).not.toBeNull();
          expect(suspendBox).not.toBeNull();
          expect(footerBox?.y).toBeGreaterThanOrEqual(
            Math.max(
              (reasonBox?.y ?? 0) + (reasonBox?.height ?? 0),
              (suspendBox?.y ?? 0) + (suspendBox?.height ?? 0),
            ),
          );

          await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
          await expect(dialog).toBeHidden();
        }
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/moderation 可更新评论状态与备注", async ({
  adminFlow,
  run,
  page,
  moderation,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        test.setTimeout(60000);
        await gotoAndWaitForReady(page, "/admin/moderation");

        const keyword = moderation.comment.body;
        const note = "Independent moderation note";
        await gotoAndWaitForReady(
          page,
          `/admin/moderation?search=${encodeURIComponent(keyword)}`,
        );
        await expect(visibleText(page, keyword)).toBeVisible();
        const dialog = await openModerationCommentDialog(page, keyword);

        const privateButton = dialog
          .getByRole("radio", { name: /仅自己可见|Private/i })
          .first();
        await privateButton.click();
        await expect(privateButton).toHaveAttribute("aria-checked", "true");
        await dialog
          .getByLabel(/备注|Moderation note|Note/i)
          .first()
          .fill(note);

        const patchResponse = observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response.url().includes("/api/admin/comments/") &&
                response.request().method() === "PATCH" &&
                response.status() === 200,
            ),
          () => dialog.getByRole("button", { name: /确认|Confirm/i }).click(),
        );
        await patchResponse;
        expect(
          await moderation.db.comment.findUnique({
            where: { id: moderation.comment.id },
          }),
        ).toMatchObject({
          status: "softbanned",
          moderationNote: note,
          moderatedById: moderation.admin.id,
        });
        await expect(dialog).not.toBeVisible({ timeout: 15_000 });
        await expect(
          page
            .locator("[data-sonner-toast]")
            .filter({ hasText: /评论已更新|Comment updated/i }),
        ).toBeVisible();
        await captureStepScreenshot(page, testInfo, "admin-moderation-updated");
      },
      { auditActions: { admin_comment_moderate: 1 } },
      adminWriteChecks([
        ["PATCH", `/api/admin/comments/${moderation.comment.id}`, 200],
      ]),
    ),
  );
});

test("/admin/moderation 目标链接可跳转到原页面锚点", async ({
  adminFlow,
  run,
  page,
  moderation,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        test.setTimeout(60000);
        const sectionPath = `/catalog/sections/${moderation.section.jwId}`;
        await gotoAndWaitForReady(page, sectionPath);
        await gotoAndWaitForReady(page, sectionPath);

        await gotoAndWaitForReady(page, `${sectionPath}#comments`);

        const body = `Target link ${moderation.marker}`;
        const composer = await openCommentComposer(page);
        await composer.fill(body);
        const createResponse = observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response.url().includes("/api/community/comments") &&
                response.request().method() === "POST" &&
                response.status() === 201,
            ),
          () =>
            page
              .locator("#comments")
              .getByRole("button", { name: /发布评论|Post comment/i })
              .click(),
        );
        const created = await createResponse;
        const createdBody = (await created.json()) as { id?: string };
        const id = createdBody.id;
        expect(typeof id).toBe("string");
        expect(
          await moderation.db.comment.findUnique({ where: { id: String(id) } }),
        ).toMatchObject({
          userId: moderation.admin.id,
          sectionId: moderation.section.id,
          body,
          status: "active",
        });

        await gotoAndWaitForReady(page, "/admin/moderation");
        await page
          .getByPlaceholder(/搜索评论内容或 ID|Search comment content or ID/i)
          .fill(body);
        await expect(visibleText(page, body)).toBeVisible();
        const manageDialog = await openModerationCommentDialog(page, body);
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
      },
      { auditActions: { comment_create: 1 } },
      adminWriteChecks([["POST", "/api/community/comments", 201]]),
    ),
  );
});

test("/admin/moderation 可切换状态筛选下拉", async ({
  adminFlow,
  run,
  page,
  moderation: _moderation,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(page, "/admin/moderation");

        const filter = page.getByRole("combobox").first();
        await expect(filter).toBeVisible();
        const option = page
          .getByRole("option", { name: /已删除|Deleted/i })
          .first();
        await expect(option).toBeAttached();
        await filter.selectOption("deleted");
        await expect(filter).toHaveValue("deleted");
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-moderation-filter-deleted",
        );
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/moderation 封禁列表可解除封禁", async ({
  adminFlow,
  run,
  page,
  moderation,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        test.setTimeout(60000);
        await gotoAndWaitForReady(page, "/admin/moderation");
        const reason = moderation.marker;
        const createSuspensionResponse = await page.request.post(
          "/api/admin/suspensions",
          {
            data: {
              userId: moderation.author.id,
              reason,
            },
          },
        );
        expect(createSuspensionResponse.status()).toBe(201);
        const createdBody = (await createSuspensionResponse.json()) as {
          suspension?: { id?: string };
        };
        const suspensionId = createdBody.suspension?.id;
        expect(suspensionId).toBeTruthy();
        expect(
          await moderation.db.userSuspension.findMany({
            where: { userId: moderation.author.id },
            orderBy: { createdAt: "asc" },
          }),
        ).toEqual([
          expect.objectContaining({
            id: suspensionId,
            userId: moderation.author.id,
            createdById: moderation.admin.id,
            liftedAt: null,
            reason,
          }),
        ]);
        await gotoAndWaitForReady(page, "/admin/moderation?tab=suspensions");
        const row = page
          .locator("tbody tr:visible")
          .filter({ hasText: reason });
        await expect(row).toBeVisible();
        const liftButton = row.getByRole("button", {
          name: /解除封禁|Lift suspension/i,
        });
        await liftButton.click();
        const confirmDialog = page.getByRole("alertdialog", {
          name: /解除这条封禁|Lift this suspension/i,
        });
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog).toContainText(moderation.author.name);
        await confirmDialog
          .getByRole("button", { name: /取消|Cancel/i })
          .click();
        await expect(confirmDialog).toBeHidden();

        await liftButton.click();
        const liftResponse = observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response.request().method() === "POST" &&
                response.url().includes("/admin/moderation") &&
                response.url().includes("liftSuspension"),
            ),
          () =>
            confirmDialog
              .getByRole("button", {
                name: /确认解除封禁|Lift suspension/i,
              })
              .click(),
        );
        expect((await liftResponse).status()).toBe(200);
        expect(
          await moderation.db.userSuspension.findMany({
            where: { userId: moderation.author.id },
            orderBy: { createdAt: "asc" },
          }),
        ).toEqual([
          expect.objectContaining({
            id: suspensionId,
            userId: moderation.author.id,
            liftedAt: expect.any(Date),
            liftedById: moderation.admin.id,
          }),
        ]);
        await expect(row.getByText(/已解除|Lifted/i)).toBeVisible();
        await expect(
          page
            .locator("[data-sonner-toast]")
            .filter({ hasText: /封禁已解除|Suspension lifted/i }),
        ).toBeVisible();
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-moderation-suspended",
        );
      },
      { auditActions: { admin_user_suspend: 1, admin_user_unsuspend: 1 } },
      adminWriteChecks(
        [["POST", "/admin/moderation", 200]],
        [
          ["POST", "/api/admin/suspensions", 201],
          ["POST", "/admin/moderation", 200],
        ],
      ),
    ),
  );
});

test("/admin/moderation 可从评论弹窗封禁并解除用户", async ({
  adminFlow,
  run,
  page,
  moderation,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        test.setTimeout(60000);
        const body = moderation.comment.body;
        const userPage = await moderation.authorPage(adminFlow);
        await gotoAndWaitForReady(page, "/admin/moderation");
        await page
          .getByPlaceholder(/搜索评论内容或 ID|Search comment content or ID/i)
          .fill(body);
        await expect(visibleText(page, body)).toBeVisible();
        await openModerationCommentDialog(page, body);

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByText(/封禁|Suspension|Suspend/i).first(),
        ).toBeVisible();

        const reason = moderation.marker;
        const reasonInput = dialog.getByRole("textbox", {
          name: /原因|Reason/i,
        });
        await expect(reasonInput).toBeVisible();
        await reasonInput.fill(reason);

        const suspendResponse = observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response.url().includes("/api/admin/suspensions") &&
                response.request().method() === "POST",
            ),
          () => dialog.getByRole("button", { name: /封禁|Suspend/i }).click(),
        );
        const created = await suspendResponse;
        expect(created.status()).toBe(201);
        const createdBody = (await created.json()) as {
          suspension?: { id?: string };
        };
        const suspensionId = createdBody.suspension?.id;
        expect(typeof suspensionId).toBe("string");
        await expect(
          page
            .locator("[data-sonner-toast]")
            .filter({ hasText: /封禁成功|Suspended successfully/i }),
        ).toBeVisible();
        await expect(
          dialog.getByRole("button", { name: /^(封禁|Suspend)$/i }),
        ).toBeEnabled();
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-moderation-suspended-from-dialog",
        );

        expect(
          await moderation.db.userSuspension.findMany({
            where: { userId: moderation.author.id },
            orderBy: { createdAt: "asc" },
          }),
        ).toEqual([
          expect.objectContaining({
            id: suspensionId,
            userId: moderation.author.id,
            createdById: moderation.admin.id,
            liftedAt: null,
            reason,
          }),
        ]);
        const rejectedBody = `Rejected while suspended ${moderation.marker}`;
        const denied = await userPage.request.post("/api/community/comments", {
          data: {
            targetType: "section",
            targetId: String(moderation.comment.sectionId),
            body: rejectedBody,
            visibility: "public",
          },
        });
        expect(denied.status()).toBe(403);
        expect(
          await moderation.db.comment.count({
            where: { userId: moderation.author.id, body: rejectedBody },
          }),
        ).toBe(0);
        const lift = await page.request.patch(
          `/api/admin/suspensions/${suspensionId}`,
        );
        expect(lift.status()).toBe(200);
        expect(
          await moderation.db.userSuspension.findMany({
            where: { userId: moderation.author.id },
            orderBy: { createdAt: "asc" },
          }),
        ).toEqual([
          expect.objectContaining({
            id: suspensionId,
            liftedAt: expect.any(Date),
            liftedById: moderation.admin.id,
          }),
        ]);
        const recovered = await userPage.request.post(
          "/api/community/comments",
          {
            data: {
              targetType: "section",
              targetId: String(moderation.comment.sectionId),
              body: `Recovered ${moderation.marker}`,
              visibility: "public",
            },
          },
        );
        expect(recovered.status()).toBe(201);
        expect(
          await moderation.db.comment.findUnique({
            where: { id: (await recovered.json()).id },
          }),
        ).toMatchObject({
          userId: moderation.author.id,
          sectionId: moderation.comment.sectionId,
          status: "active",
        });
      },
      { auditActions: { admin_user_suspend: 1, admin_user_unsuspend: 1 } },
      adminWriteChecks(
        [["POST", "/api/admin/suspensions", 201]],
        [
          ["POST", "/api/admin/suspensions", 201],
          ["POST", "/api/community/comments", 403],
          ["PATCH", /^\/api\/admin\/suspensions\/[^/]+$/, 200],
          ["POST", "/api/community/comments", 201],
        ],
        async () => {
          expect(
            await moderation.db.auditLog.findMany({
              where: { userId: moderation.author.id },
              select: { action: true, outcome: true },
            }),
          ).toEqual([{ action: "comment_create", outcome: "success" }]);
        },
      ),
    ),
  );
});

test("admin.moderation-centralized", async ({
  adminFlow,
  run,
  page,
  moderation,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(
          page,
          `/admin/moderation?search=${moderation.marker}`,
        );
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          /Moderation|内容审核/,
        );
        await expect(
          page
            .locator("tbody tr:visible")
            .first()
            .getByRole("button", { name: /管理评论|Manage Comment/i }),
        ).toBeVisible();
        await page
          .getByRole("link", { name: /课程简介|Descriptions/i })
          .click();
        await expect(page).toHaveURL(/\/admin\/moderation\?tab=descriptions/);

        await expect(
          page.getByRole("link", { name: /课程简介|Descriptions/i }),
        ).toHaveAttribute("aria-current", "page");
        await gotoAndWaitForReady(
          page,
          `/admin/moderation?tab=descriptions&search=${moderation.marker}`,
        );
        const firstRow = moderationTableRow(
          page,
          moderation.description.content,
        );
        await expect(firstRow).toBeVisible();
        await expect(
          firstRow.getByRole("button", {
            name: /管理课程简介|Manage Description/i,
          }),
        ).toBeVisible();
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-moderation/description-table",
        );
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/moderation 简介桌面行操作可用键盘打开管理弹窗", async ({
  adminFlow,
  run,
  page,
  moderation,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(
          page,
          `/admin/moderation?tab=descriptions&search=${moderation.marker}`,
        );

        await openModerationDescriptionDialog(
          page,
          moderation.description.content,
          "keyboard",
        );
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-moderation-description-keyboard-manage",
        );
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/moderation 可更新课程简介内容", async ({
  adminFlow,
  run,
  page,
  moderation,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        test.setTimeout(60_000);
        await gotoAndWaitForReady(page, "/admin/moderation?tab=descriptions");

        const description = moderation.description;
        await gotoAndWaitForReady(
          page,
          `/admin/moderation?tab=descriptions&search=${moderation.marker}`,
        );
        const nextContent = `Updated ${moderation.marker}`;
        const dialog = await openModerationDescriptionDialog(
          page,
          description.content,
        );
        const editor = dialog.locator("#admin-description-content");
        await expect(editor).toBeVisible();
        await editor.fill(nextContent);

        const saveResponse = observeAction(
          () =>
            page.waitForResponse((response) => {
              if (response.request().method() !== "POST" || !response.ok()) {
                return false;
              }
              const url = response.url();
              return (
                url.includes("/admin/moderation") &&
                (url.includes("moderateDescription") ||
                  response
                    .request()
                    .postData()
                    ?.includes("moderateDescription") === true)
              );
            }),
          () => dialog.getByRole("button", { name: /确认|Confirm/i }).click(),
        );
        await saveResponse;
        await expect(dialog).not.toBeVisible({ timeout: 15_000 });

        const verifyResponse = await page.request.get(
          `/api/admin/descriptions?search=${encodeURIComponent(nextContent)}`,
        );
        expect(verifyResponse.status()).toBe(200);
        expect(
          (
            (await verifyResponse.json()) as {
              data?: Array<{ content?: string; id?: string }>;
            }
          ).data?.some(
            (entry) =>
              entry.id === description.id && entry.content === nextContent,
          ),
        ).toBe(true);

        await expect(
          page
            .locator("[data-sonner-toast]")
            .filter({ hasText: /课程简介已更新|Description updated/i }),
        ).toBeVisible();

        expect(
          await moderation.db.description.findUnique({
            where: { id: description.id },
          }),
        ).toMatchObject({
          content: nextContent,
          lastEditedById: moderation.admin.id,
        });
        await captureStepScreenshot(
          page,
          testInfo,
          "admin-moderation-description-updated",
        );
      },
      { auditActions: { admin_description_moderate: 1 }, catalogPurges: 1 },
      adminWriteChecks([["POST", "/admin/moderation", 200]]),
    ),
  );
});

// ── Homework governance ─────────────────────────────────────────────────────

test("/admin/moderation 作业治理可访问", async ({
  adminFlow,
  run,
  page,
  moderation,
}, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        await gotoAndWaitForReady(
          page,
          `/admin/moderation?tab=homeworks&search=${moderation.marker}`,
        );

        await expect(
          page.locator('a[aria-current="page"][href*="tab=homeworks"]'),
        ).toHaveAttribute("aria-current", "page");
        const firstRow = moderationTableRow(page, moderation.homework.title);
        await expect(firstRow).toBeVisible();
        await expect(
          page.getByRole("button", { name: /^(删除|Delete)$/i }).first(),
        ).toBeVisible();

        // Verify the homework governance API is accessible
        const hwResponse = await page.request.get(
          `/api/admin/homeworks?search=${moderation.marker}`,
        );
        expect(hwResponse.status()).toBe(200);
        const hwBody = (await hwResponse.json()) as {
          data?: Array<{ id?: string }>;
        };
        expect(hwBody.data).toEqual([
          expect.objectContaining({ id: moderation.homework.id }),
        ]);

        await captureStepScreenshot(
          page,
          testInfo,
          "admin-moderation/homework-governance",
        );
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("页面契约", async ({ adminFlow, run, page, moderation }, testInfo) => {
  await run(() =>
    adminFlow.run(
      async () => {
        const response = await gotoAndWaitForReady(
          page,
          `/admin/moderation?search=${moderation.marker}`,
          {
            browserHealth: {},
            expectMeaningfulContent: true,
            expectNoHorizontalOverflow: true,
            uiQuality: {},
            testInfo,
          },
        );
        expect(response?.ok()).toBe(true);
        await expect(
          page.getByRole("link", { name: /评论|Comments/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: /Moderation|内容审核/, level: 1 }),
        ).toBeVisible();
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("admin.high-risk-feedback", async ({
  moderationRun,
  page,
  moderation,
}, testInfo) => {
  await moderationRun(async () => {
    const marker = moderation.marker;
    const fixture = {
      user: moderation.author,
      homework: moderation.homework,
      comment: moderation.comment,
    };
    await moderation.db.comment.update({
      where: { id: fixture.comment.id },
      data: { sectionId: null, homeworkId: fixture.homework.id },
    });
    await gotoAndWaitForReady(
      page,
      `/admin/moderation?search=${encodeURIComponent(marker)}`,
    );
    const dialog = await openModerationCommentDialog(page, marker);
    await dialog.getByRole("radio", { name: /仅自己可见|Private/i }).click();
    await dialog.getByRole("button", { name: /确认|Confirm/i }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page
        .locator("[data-sonner-toast]")
        .filter({ hasText: /评论已更新|Comment updated/i }),
    ).toBeVisible();
    expect(
      (
        await moderation.db.comment.findUniqueOrThrow({
          where: { id: fixture.comment.id },
        })
      ).status,
    ).toBe("softbanned");
    await captureStepScreenshot(page, testInfo, "admin-feedback-hidden");
    await gotoAndWaitForReady(
      page,
      `/admin/moderation?search=${encodeURIComponent(marker)}&status=softbanned`,
    );
    const reopened = await openModerationCommentDialog(page, marker);
    await reopened.getByRole("textbox", { name: /原因|Reason/i }).fill(marker);
    await reopened.getByRole("button", { name: /^(封禁|Suspend)$/i }).click();
    await expect(
      page
        .locator("[data-sonner-toast]")
        .filter({ hasText: /封禁成功|Suspended successfully/i }),
    ).toBeVisible();
    expect(
      await moderation.db.userSuspension.count({
        where: { userId: fixture.user.id, liftedAt: null, reason: marker },
      }),
    ).toBe(1);
    await captureStepScreenshot(page, testInfo, "admin-feedback-suspended");
    await page.keyboard.press("Escape");
    await gotoAndWaitForReady(
      page,
      `/admin/moderation?tab=homeworks&search=${encodeURIComponent(marker)}`,
    );
    const row = moderationTableRow(page, marker);
    await row.getByRole("button", { name: /^(删除|Delete)$/i }).click();
    const confirmation = page.getByRole("alertdialog", {
      name: /删除作业|Delete Homework/i,
    });
    await expect(confirmation).toContainText(marker);
    await confirmation.getByRole("button", { name: /取消|Cancel/i }).click();
    expect(
      (
        await moderation.db.homework.findUniqueOrThrow({
          where: { id: fixture.homework.id },
        })
      ).deletedAt,
    ).toBeNull();
    await row.getByRole("button", { name: /^(删除|Delete)$/i }).click();
    await confirmation
      .getByRole("button", { name: /^(删除|Delete)$/i })
      .click();
    await expect(confirmation).toBeHidden();
    await expect(
      page
        .locator("[data-sonner-toast]")
        .filter({ hasText: /作业已删除|Homework deleted/i }),
    ).toBeVisible();
    expect(
      (
        await moderation.db.homework.findUniqueOrThrow({
          where: { id: fixture.homework.id },
        })
      ).deletedAt,
    ).not.toBeNull();
    await captureStepScreenshot(page, testInfo, "admin-feedback-deleted");
  });
});
