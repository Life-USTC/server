/**
 * E2E: /catalog/sections/[jwId] — Section comment CRUD, anonymity, and attachments
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser, signInAsDevAdmin } from "../../../../utils/auth";
import {
  cleanupCommentsForE2e,
  openCommentComposer,
} from "../../../../utils/comments";
import { DEV_SEED } from "../../../../utils/dev-seed";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { deleteUploadById } from "../../../../utils/uploads";
import {
  jumpToSection,
  openCommentDeleteDialog,
  SECTION_URL,
} from "./_helpers";

test.describe("/catalog/sections/[jwId] 班级详情页", () => {
  test("已登录用户可发布、回应、编辑、回复与删除评论", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDevAdmin(page, SECTION_URL);
    let commentId: string | undefined;
    let replyId: string | undefined;

    try {
      await jumpToSection(page, /评论|Comments/i, "#comments");

      // Post comment
      const body = `e2e-section-comment-${Date.now()}`;
      const composer = await openCommentComposer(page);
      await composer.fill(body);
      const createResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/comments") &&
          r.request().method() === "POST" &&
          r.status() === 201,
      );
      await page
        .locator("#comments")
        .getByRole("button", { name: /发布评论|Post comment/i })
        .click();
      const createdCommentResponse = await createResponse;
      const createResponseBody = (await createdCommentResponse.json()) as {
        id?: string;
      };
      expect(createResponseBody.id).toBeTruthy();
      commentId = createResponseBody.id;
      await expect(page.getByText(body).first()).toBeVisible();
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /评论已发布|Comment posted/i }),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/comment-posted");

      const commentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: body })
        .first();
      await expect(commentCard).toBeVisible();
      const commentCardId = await commentCard.getAttribute("id");
      expect(commentCardId).toBeTruthy();

      // comment.author.name (display.fields)
      await expect(
        commentCard.getByText(DEV_SEED.adminName).first(),
      ).toBeVisible();
      // comment.body (markdown rendered)
      await expect(commentCard.getByText(body).first()).toBeVisible();

      // React with upvote (comment.reactions[])
      const reactionResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/comments/") &&
          r.url().includes("/reactions") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      await commentCard
        .getByRole("button", { name: /表情|Reactions/i })
        .click({ force: true });
      await page
        .getByRole("menuitemcheckbox", { name: /点赞|Upvote/i })
        .click();
      await reactionResponse;
      await waitForUiSettled(page);
      await expect(
        commentCard.getByRole("button", { name: /👍/ }),
      ).toBeVisible();
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /表情已更新|Reaction updated/i }),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/comment-upvoted");

      // Edit comment (canEdit action)
      await commentCard.hover();
      await commentCard.getByRole("button", { name: /编辑|Edit/i }).click();
      const editedBody = `${body}-edited`;
      const editCard = page.locator(`[id="${commentCardId}"]`);
      const editTextarea = editCard
        .getByRole("textbox", {
          name: /编辑评论内容|Edit comment body/i,
        })
        .first();
      await expect(editTextarea).toBeVisible();
      await editTextarea.fill(editedBody);
      const editResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/comments/") &&
          r.request().method() === "PATCH" &&
          r.status() === 200,
      );
      await editCard.getByRole("button", { name: /保存|Save/i }).click();
      await editResponse;
      // comment.updatedAt / edited timestamp visible
      await expect(page.getByText(editedBody).first()).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/comment-edited");
      const editedCommentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: editedBody })
        .first();
      await expect(editedCommentCard).toBeVisible();
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /评论已更新|Comment updated/i }),
      ).toBeVisible();

      // Reply (canReply action, comment.replies[])
      await editedCommentCard
        .getByRole("button", { name: /回复|Reply/i })
        .click({ force: true });
      const replyBody = `e2e-reply-${Date.now()}`;
      const replyTextbox = page
        .getByRole("textbox", { name: /回复内容|Reply body/i })
        .first();
      await expect(replyTextbox).toBeVisible();
      await replyTextbox.fill(replyBody);
      const replyEditor = replyTextbox.locator(
        "xpath=ancestor::*[@data-slot='field-group'][1]",
      );
      const replyResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/comments") &&
          r.request().method() === "POST" &&
          r.status() === 201,
      );
      await replyEditor.getByRole("button", { name: /回复|Reply/i }).click();
      const createdReplyResponse = await replyResponse;
      const replyResponseBody = (await createdReplyResponse.json()) as {
        id?: string;
      };
      expect(replyResponseBody.id).toBeTruthy();
      replyId = replyResponseBody.id;
      await expect(page.getByText(replyBody).first()).toBeVisible();
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /回复已发布|Reply posted/i }),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/comment-replied");

      // Delete comment
      const deleteDialog = await openCommentDeleteDialog(
        page,
        editedCommentCard,
      );
      const deleteFooterButtons = deleteDialog.locator(
        '[data-slot="alert-dialog-footer"] button',
      );
      await expect(deleteFooterButtons).toHaveCount(2);
      await expect(deleteFooterButtons.nth(0)).toHaveAttribute(
        "data-slot",
        "alert-dialog-cancel",
      );
      await expect(deleteFooterButtons.nth(1)).toHaveAttribute(
        "data-slot",
        "alert-dialog-action",
      );
      await page.keyboard.press("Escape");
      await expect(deleteDialog).toBeHidden();

      const reopenedDeleteDialog = await openCommentDeleteDialog(
        page,
        editedCommentCard,
      );
      let releaseDeleteRequest!: () => void;
      const deleteRequestGate = new Promise<void>((resolve) => {
        releaseDeleteRequest = resolve;
      });
      await page.route("**/api/community/comments/**", async (route) => {
        if (route.request().method() !== "DELETE") {
          await route.continue();
          return;
        }
        await deleteRequestGate;
        await route.continue();
      });
      const deleteResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/comments/") &&
          r.request().method() === "DELETE" &&
          r.status() === 200,
      );
      await reopenedDeleteDialog
        .getByRole("button", { name: /删除|Delete/i })
        .click();
      await expect(reopenedDeleteDialog).toBeVisible();
      await expect(
        reopenedDeleteDialog.getByRole("button", { name: /删除|Delete/i }),
      ).toBeDisabled();
      await expect(
        reopenedDeleteDialog.getByRole("button", { name: /取消|Cancel/i }),
      ).toBeDisabled();
      await expect(
        reopenedDeleteDialog.locator('[data-icon="inline-start"]'),
      ).toBeVisible();
      releaseDeleteRequest();
      await deleteResponse;
      await page.unroute("**/api/community/comments/**");
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /评论已删除|Comment deleted/i }),
      ).toBeVisible();
      await expect(editedCommentCard).toHaveCount(0);
      await captureStepScreenshot(page, testInfo, "section/comment-deleted");
    } finally {
      await cleanupCommentsForE2e([replyId, commentId]);
    }
  });

  test("匿名评论复选框会隐藏评论者身份", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    let commentId: string | undefined;
    const body = `e2e-anonymous-comment-${Date.now()}`;

    try {
      await signInAsDebugUser(page, SECTION_URL);

      await jumpToSection(page, /评论|Comments/i, "#comments");

      const comments = page.locator("#comments");
      await openCommentComposer(page, comments);

      const anonymousCheckbox = comments
        .getByRole("checkbox", { name: /匿名|Anonymous/i })
        .first();
      await expect(anonymousCheckbox).toBeVisible();
      await anonymousCheckbox.click();
      await expect(anonymousCheckbox).toHaveAttribute("aria-checked", "true");

      await comments
        .getByRole("textbox", { name: /评论内容|Comment body/i })
        .first()
        .fill(body);

      const createResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/comments") &&
          r.request().method() === "POST" &&
          r.status() === 201,
      );
      await comments
        .getByRole("button", { name: /发布评论|Post comment/i })
        .click();
      const createdCommentResponse = await createResponse;
      const createResponseBody = (await createdCommentResponse.json()) as {
        id?: string;
      };
      expect(createResponseBody.id).toBeTruthy();
      commentId = createResponseBody.id;

      const commentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: body })
        .first();
      await expect(commentCard).toBeVisible();
      await expect(commentCard.getByText(body)).toBeVisible();
      // Author sees their own name and an anonymous badge
      await expect(
        commentCard.getByText(DEV_SEED.debugName).first(),
      ).toBeVisible();
      await expect(
        commentCard.getByText(/匿名|Anonymous/i).first(),
      ).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "section/comment-anonymous-author",
      );

      // View the same comment without signing in: identity is masked
      await page.context().clearCookies();
      await gotoAndWaitForReady(page, SECTION_URL);
      await jumpToSection(page, /评论|Comments/i, "#comments");

      const anonymousCommentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: body })
        .first();
      await expect(anonymousCommentCard).toBeVisible();
      await expect(anonymousCommentCard.getByText(body).first()).toBeVisible();
      await expect(
        anonymousCommentCard.getByText(DEV_SEED.debugName),
      ).toHaveCount(0);
      await expect(
        anonymousCommentCard.getByText(/匿名|Anonymous/i).first(),
      ).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "section/comment-anonymous-masked",
      );
    } finally {
      await cleanupCommentsForE2e([commentId]);
    }
  });

  test("评论可上传附件并通过签名下载链接打开", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const filename = `e2e-attachment-${Date.now()}.txt`;
    const body = `e2e-attachment-comment-${Date.now()}`;
    let uploadId: string | undefined;
    let commentId: string | undefined;

    try {
      await signInAsDebugUser(page, "/");
      await gotoAndWaitForReady(page, SECTION_URL);

      await expect(async () => {
        if (
          !page.url().includes(`/catalog/sections/${DEV_SEED.section.jwId}`)
        ) {
          await gotoAndWaitForReady(page, SECTION_URL);
        }
        await jumpToSection(page, /评论|Comments/i, "#comments");
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });

      const comments = page.locator("#comments");
      await openCommentComposer(page, comments);
      const uploadInput = comments.locator('input[type="file"]').first();
      await expect(uploadInput).toBeAttached();
      const uploadButton = comments
        .getByRole("button", {
          name: /上传文件|上传附件|Upload file|Upload attachment/i,
        })
        .first();
      await uploadButton.focus();
      await expect(uploadButton).toBeFocused();

      // Upload attachment (upload.yml three-step flow)
      const uploadCreate = page.waitForResponse(
        (r) =>
          r.url().includes("/api/workspace/uploads") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      const uploadPut = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          r.status() >= 200 &&
          r.status() < 300 &&
          r.url().startsWith("http"),
      );
      const uploadComplete = page.waitForResponse(
        (r) =>
          r.url().includes("/api/workspace/uploads/complete") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );

      await comments.locator('input[type="file"]').setInputFiles({
        name: filename,
        mimeType: "text/plain",
        buffer: Buffer.from("section-attachment"),
      });
      await uploadCreate;
      await uploadPut;
      const uploadCompleteResponse = await uploadComplete;
      const uploadCompleteBody = (await uploadCompleteResponse.json()) as {
        upload?: { id?: string };
      };
      expect(typeof uploadCompleteBody.upload?.id).toBe("string");
      uploadId = uploadCompleteBody.upload?.id;

      await comments
        .getByRole("textbox", { name: /评论内容|Comment body/i })
        .first()
        .fill(body);
      const postButton = comments
        .getByRole("button", { name: /发布评论|Post comment/i })
        .first();
      await expect(postButton).toBeEnabled();
      const createComment = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/comments") &&
          r.request().method() === "POST" &&
          r.status() === 201,
      );
      await postButton.click();
      const createCommentResponse = await createComment;
      const createCommentBody = (await createCommentResponse.json()) as {
        id?: string;
      };
      expect(typeof createCommentBody.id).toBe("string");
      commentId = createCommentBody.id;
      await waitForUiSettled(page);

      const commentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: body })
        .first();
      await expect(commentCard).toBeVisible();
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /已可分享|is ready to share/i }),
      ).toBeVisible();
      // comment.attachments[] filename/open action (comment.yml display.fields)
      await expect(
        commentCard
          .getByRole("link", { name: /打开附件|Open attachment/i })
          .first(),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/comment-attachment");

      // Download is served by the authorized on-site R2 streaming route.
      const popupPromise = page.waitForEvent("popup");
      await commentCard
        .getByRole("link", { name: /打开附件|Open attachment/i })
        .first()
        .click();
      const popup = await popupPromise;
      await popup.waitForLoadState("domcontentloaded");
      await expect(popup).toHaveURL(/\/api\/workspace\/uploads\/.*\/download/);
      await popup.close();

      // Cleanup
      const dlg = await openCommentDeleteDialog(page, commentCard);
      const deleteResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/comments/") &&
          r.request().method() === "DELETE" &&
          r.status() === 200,
      );
      await dlg.getByRole("button", { name: /删除|Delete/i }).click();
      await deleteResponse;
    } finally {
      await cleanupCommentsForE2e([commentId]);
      if (uploadId) {
        await deleteUploadById(page, uploadId);
      }
    }
  });
});
