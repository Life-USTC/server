/**
 * E2E: /catalog/sections/[jwId] — Section comment CRUD, anonymity, and attachments
 */
import { expect } from "@playwright/test";
import { test as uploadTest } from "../../../../utils/comment-upload-fixture";
import { openCommentComposer } from "../../../../utils/comments";
import { storedComment, test } from "../../../../utils/community-fixture";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { openCommentDeleteDialog } from "./_helpers";

test.describe("/catalog/sections/[jwId] 班级详情页", () => {
  test.describe.configure({ mode: "parallel" });

  test("已登录用户可发布、回应、编辑、回复与删除评论", async ({
    page,
    account,
    community,
  }, testInfo) => {
    test.setTimeout(60_000);
    await gotoAndWaitForReady(
      page,
      `/catalog/sections/${community.section.jwId}`,
    );
    let releaseDeleteRequest = () => {};
    let commentId: string | undefined;
    let replyId: string | undefined;

    try {
      await gotoAndWaitForReady(
        page,
        `/catalog/sections/${community.section.jwId}#comments`,
      );

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
        id: string;
      };
      expect(createResponseBody.id).toBeTruthy();
      commentId = createResponseBody.id;
      expect(await storedComment(commentId)).toMatchObject({
        userId: account.id,
        sectionId: community.section.id,
        body,
        status: "active",
      });
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
      await expect(commentCard.getByText(account.name).first()).toBeVisible();
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
      expect((await storedComment(commentId))?.reactions).toEqual([
        expect.objectContaining({ userId: account.id, type: "upvote" }),
      ]);
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
      expect(await storedComment(commentId)).toMatchObject({
        body: editedBody,
        status: "active",
      });
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
        id: string;
      };
      expect(replyResponseBody.id).toBeTruthy();
      replyId = replyResponseBody.id;
      expect(await storedComment(replyId)).toMatchObject({
        userId: account.id,
        body: replyBody,
        parentId: commentId,
        rootId: commentId,
      });
      await expect(page.getByText(replyBody).first()).toBeVisible();
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /回复已发布|Reply posted/i }),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/comment-replied");

      // Follow the share link and refresh the rendered thread after the UI writes.
      await gotoAndWaitForReady(page, `/community/comments/${commentId}`);
      await expect(editedCommentCard).toContainText(editedBody);
      await expect(page.locator(`#comment-${replyId}`)).toContainText(
        replyBody,
      );
      await page.reload();
      await expect(
        editedCommentCard.getByRole("button", { name: /👍/ }),
      ).toBeVisible();

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
      expect(await storedComment(commentId)).toMatchObject({
        status: "deleted",
        deletedAt: expect.any(Date),
      });
      await page.unroute("**/api/community/comments/**");
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /评论已删除|Comment deleted/i }),
      ).toBeVisible();
      await expect(editedCommentCard).toHaveCount(0);
      await captureStepScreenshot(page, testInfo, "section/comment-deleted");
    } finally {
      releaseDeleteRequest();
      await page.unrouteAll({ behavior: "wait" });
    }
  });

  test("匿名评论复选框会隐藏评论者身份", async ({
    page,
    account,
    community,
  }, testInfo) => {
    test.setTimeout(60_000);
    const body = `e2e-anonymous-comment-${Date.now()}`;

    await gotoAndWaitForReady(
      page,
      `/catalog/sections/${community.section.jwId}`,
    );

    await gotoAndWaitForReady(
      page,
      `/catalog/sections/${community.section.jwId}#comments`,
    );

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
      id: string;
    };
    expect(createResponseBody.id).toBeTruthy();
    const commentId = createResponseBody.id;
    expect(await storedComment(commentId)).toMatchObject({
      userId: account.id,
      sectionId: community.section.id,
      body,
      status: "active",
      isAnonymous: true,
    });

    const commentCard = page
      .locator('[id^="comment-"]')
      .filter({ hasText: body })
      .first();
    await expect(commentCard).toBeVisible();
    await expect(commentCard.getByText(body)).toBeVisible();
    // Ordinary reads conceal the author's identity even from the author.
    await expect(commentCard.getByText(account.name).first()).toHaveCount(0);
    await expect(
      commentCard.locator('a[href^="/community/users/"]'),
    ).toHaveCount(0);
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
    await gotoAndWaitForReady(
      page,
      `/catalog/sections/${community.section.jwId}`,
    );
    await gotoAndWaitForReady(
      page,
      `/catalog/sections/${community.section.jwId}#comments`,
    );

    const anonymousCommentCard = page
      .locator('[id^="comment-"]')
      .filter({ hasText: body })
      .first();
    await expect(anonymousCommentCard).toBeVisible();
    await expect(anonymousCommentCard.getByText(body).first()).toBeVisible();
    await expect(anonymousCommentCard.getByText(account.name)).toHaveCount(0);
    await expect(
      anonymousCommentCard.getByText(/匿名|Anonymous/i).first(),
    ).toBeVisible();
    await captureStepScreenshot(
      page,
      testInfo,
      "section/comment-anonymous-masked",
    );
  });

  uploadTest(
    "upload.three-step-upload",
    async ({ page, account, community, upload }, testInfo) => {
      const filename = "independent-section-attachment.txt";
      const body = "Independent section attachment comment";
      const contents = "section-attachment";
      await gotoAndWaitForReady(
        page,
        `/catalog/sections/${community.section.jwId}#comments`,
      );
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
          new URL(r.url()).pathname === "/api/workspace/uploads" &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      const uploadPut = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          r.status() >= 200 &&
          r.status() < 300 &&
          new URL(r.url()).origin === new URL(page.url()).origin &&
          new URL(r.url()).pathname === "/api/workspace/uploads/object",
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
        buffer: Buffer.from(contents),
      });
      const uploadCreateResponse = await uploadCreate;
      const uploadPutResponse = await uploadPut;
      const uploadCompleteResponse = await uploadComplete;
      const session = await uploadCreateResponse.json();
      expect(new URL(session.url).origin).toBe(new URL(page.url()).origin);
      expect(uploadPutResponse.url()).toBe(session.url);
      expect(new URL(session.url).searchParams.get("key")).toBe(session.key);
      expect(uploadCompleteResponse.request().postDataJSON()).toMatchObject({
        key: session.key,
        filename,
      });
      expect(
        uploadCreateResponse.request().timing().startTime,
      ).toBeLessThanOrEqual(uploadPutResponse.request().timing().startTime);
      expect(
        uploadPutResponse.request().timing().startTime,
      ).toBeLessThanOrEqual(
        uploadCompleteResponse.request().timing().startTime,
      );
      const uploadCompleteBody = (await uploadCompleteResponse.json()) as {
        upload: { id: string };
      };
      expect(typeof uploadCompleteBody.upload?.id).toBe("string");
      const uploadId = uploadCompleteBody.upload.id;

      expect(upload.steps.map((step) => step.path)).toEqual([
        "/api/workspace/uploads",
        "/api/workspace/uploads/object",
        "/api/workspace/uploads/complete",
      ]);
      const [reserved, uploaded, completed] = upload.steps;
      expect(reserved.state.pending).toEqual([
        expect.objectContaining({
          userId: account.id,
          key: session.key,
          filename,
          size: Buffer.byteLength(contents),
          phase: "reserved",
        }),
      ]);
      expect(reserved.state.uploads).toEqual([]);
      expect(reserved.state.objects).toEqual([]);
      expect(uploaded.state.pending).toEqual([
        expect.objectContaining({
          userId: account.id,
          key: session.key,
          phase: "uploaded",
        }),
      ]);
      expect(uploaded.state.uploads).toEqual([]);
      expect(uploaded.state.objects).toEqual([
        { key: session.key, body: Array.from(Buffer.from(contents)) },
      ]);
      expect(completed.state.pending).toEqual([]);
      expect(completed.state.uploads).toEqual([
        expect.objectContaining({
          id: uploadId,
          userId: account.id,
          key: session.key,
          filename,
          size: Buffer.byteLength(contents),
          contentType: "text/plain",
        }),
      ]);
      expect(completed.state.objects).toEqual([
        { key: session.key, body: Array.from(Buffer.from(contents)) },
      ]);
      expect(completed.state.attachments).toEqual([]);

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
        id: string;
      };
      expect(typeof createCommentBody.id).toBe("string");
      const commentId = createCommentBody.id;
      await waitForUiSettled(page);
      expect(await storedComment(commentId)).toMatchObject({
        userId: account.id,
        sectionId: community.section.id,
        body,
        status: "active",
      });
      expect((await upload.observe()).attachments).toEqual([
        expect.objectContaining({ commentId, uploadId }),
      ]);

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
      const download = await page.request.get(
        `/api/workspace/uploads/${uploadId}/download`,
      );
      expect(download.status()).toBe(200);
      expect(await download.text()).toBe(contents);
      expect((await upload.observe()).objects).toEqual([
        { key: session.key, body: Array.from(Buffer.from(contents)) },
      ]);

      // Delete through the UI; fixture teardown owns physical object cleanup.
      const dlg = await openCommentDeleteDialog(page, commentCard);
      const deleteResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/comments/") &&
          r.request().method() === "DELETE" &&
          r.status() === 200,
      );
      await dlg.getByRole("button", { name: /删除|Delete/i }).click();
      await deleteResponse;
      expect(await storedComment(commentId)).toMatchObject({
        status: "deleted",
        deletedAt: expect.any(Date),
      });
      await expect(commentCard).toHaveCount(0);
    },
  );
});
