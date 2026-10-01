/**
 * E2E: /catalog/sections/[jwId] — Independent section comment mutations, consumers, and upload protocol
 */
import { expect, type Locator, type Page, type Route } from "@playwright/test";
import {
  storedComment,
  test,
  test as uploadTest,
} from "../../../../utils/comment-upload-fixture";
import { openCommentComposer } from "../../../../utils/comments";
import { observeAction } from "../../../../utils/observed-action";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { openCommentDeleteDialog } from "./_helpers";

const seededAt = new Date("2026-02-04T02:23:00.000Z");
const seededEditedAt = new Date("2026-02-05T03:45:00.000Z");
type CommentDatabase = Parameters<typeof storedComment>[0];
type CommentContext = {
  account: { id: string };
  community: { section: { id: number } };
  isolatedWorker: { database: { owner: CommentDatabase } };
};

/** Known initial state: one comment owned by the signed-in account and one by
 * another author, both at fixed timestamps. */
async function seedSectionComments({
  account,
  community,
  isolatedWorker,
}: CommentContext) {
  const db = isolatedWorker.database.owner;
  const seeded = await db.$transaction(async (tx) => {
    const other = await tx.user.create({
      data: {
        name: "Other section commenter",
        email: `comment-${crypto.randomUUID()}@test.invalid`,
      },
    });
    const id = crypto.randomUUID();
    const foreignId = crypto.randomUUID();
    const comment = await tx.comment.create({
      data: {
        id,
        rootId: id,
        userId: account.id,
        sectionId: community.section.id,
        body: "Known section comment",
        createdAt: seededAt,
        updatedAt: seededAt,
      },
    });
    const foreign = await tx.comment.create({
      data: {
        id: foreignId,
        rootId: foreignId,
        userId: other.id,
        sectionId: community.section.id,
        body: "Other author's preserved comment",
        createdAt: seededAt,
        updatedAt: seededAt,
      },
    });
    return { comment, foreign };
  });
  return { db, ...seeded };
}

function commentRows(db: CommentDatabase) {
  return db.comment.findMany({
    orderBy: { id: "asc" },
    include: {
      reactions: { orderBy: [{ userId: "asc" }, { type: "asc" }] },
    },
  });
}

async function expectOtherComments(
  db: CommentDatabase,
  before: Awaited<ReturnType<typeof commentRows>>,
  targetId: string,
) {
  expect((await commentRows(db)).filter((row) => row.id !== targetId)).toEqual(
    before.filter((row) => row.id !== targetId),
  );
}

async function useEnglish(page: Page, origin: string) {
  await page
    .context()
    .addCookies([{ name: "NEXT_LOCALE", value: "en-us", url: origin }]);
}

async function openSectionComments(page: Page, origin: string, jwId: number) {
  await useEnglish(page, origin);
  await gotoAndWaitForReady(page, `/catalog/sections/${jwId}#comments`);
}

async function openCommentPermalink(page: Page, origin: string, id: string) {
  await useEnglish(page, origin);
  await gotoAndWaitForReady(page, `/community/comments/${id}`);
}

function commentResponse(page: Page, method: string, path: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      new URL(response.url()).pathname === path,
  );
}

async function expectToast(page: Page, text: RegExp) {
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: text }),
  ).toBeVisible();
}

async function expectNoOwnershipActions(page: Page, card: Locator) {
  await expect(card.getByRole("button", { name: /编辑|Edit/i })).toHaveCount(0);
  await card.getByRole("button", { name: /更多操作|More actions/i }).click();
  const menu = page.getByRole("menu").last();
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: /删除|Delete/i }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
}

async function expectAnonymousCard(
  card: Locator,
  author: string,
  body: string,
) {
  await expect(card).toBeVisible();
  await expect(card.getByText(body, { exact: true })).toBeVisible();
  await expect(card.getByText(author, { exact: true })).toHaveCount(0);
  await expect(card.locator('a[href^="/community/users/"]')).toHaveCount(0);
  await expect(card.getByText(/匿名|Anonymous/i).first()).toBeVisible();
}

/** The known thread renders the same body, reply, reaction and edit timestamp
 * for every reader; only the actions it offers depend on the identity.
 * `/community/comments/[id]` resolves the canonical target address and redirects
 * there, so the target page legitimately renders every viewer-visible root of
 * that section, including the other author's public root. */
async function expectKnownThread(
  page: Page,
  viewer: "author" | "other" | "anonymous",
  thread: {
    author: string;
    canonicalUrl: string;
    commentId: string;
    otherRootBody: string;
    otherRootId: string;
    replyId: string;
  },
) {
  expect(page.url()).toBe(thread.canonicalUrl);
  const card = page.locator(`#comment-${thread.commentId}`);
  await expect(card).toBeVisible();
  await expect(
    card.getByText("Known edited share comment", { exact: true }),
  ).toBeVisible();
  await expect(card.getByText(thread.author, { exact: true })).toBeVisible();
  await expect(
    card.locator(`a[href="#comment-${thread.commentId}"]`),
  ).toHaveText("Feb 4, 2026, 10:23 AM");
  await expect(
    card.getByText("Edited Feb 5, 2026, 11:45 AM", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(`#comment-${thread.replyId}`)).toContainText(
    "Known share reply",
  );
  await expect(card.getByRole("button", { name: /👍.*1/ })).toBeVisible();
  await expect(page.locator(`#comment-${thread.otherRootId}`)).toContainText(
    thread.otherRootBody,
  );
  if (viewer === "author") {
    await expect(
      card.getByRole("button", { name: /编辑|Edit/i }),
    ).toBeVisible();
  } else await expectNoOwnershipActions(page, card);
  const reply = card.getByRole("button", { name: /回复|Reply/i });
  const reactions = card.getByRole("button", { name: /表情|Reactions/i });
  if (viewer === "anonymous") {
    await expect(reply).toHaveCount(0);
    await expect(reactions).toBeDisabled();
  } else {
    await expect(reply).toBeEnabled();
    await expect(reactions).toBeEnabled();
  }
}

test.describe("/catalog/sections/[jwId] 班级详情页", () => {
  test.describe.configure({ mode: "parallel" });

  test("已登录用户可发布评论并立即看到自己的评论卡片", async ({
    commentRun,
    page,
    account,
    community,
    isolatedWorker,
  }, testInfo) => {
    await commentRun(
      { writes: ["create"], auditActions: { comment_create: 1 } },
      async () => {
        const { db } = await seedSectionComments({
          account,
          community,
          isolatedWorker,
        });
        const before = await commentRows(db);
        const body = "Independently published section comment";
        await openSectionComments(
          page,
          isolatedWorker.origin,
          community.section.jwId,
        );
        const composer = await openCommentComposer(page);
        await composer.fill(body);
        const response = await observeAction(
          () => commentResponse(page, "POST", "/api/community/comments"),
          () =>
            page
              .locator("#comments")
              .getByRole("button", { name: /发布评论|Post comment/i })
              .click(),
        );
        expect(response.status()).toBe(201);
        const { id } = await response.json();
        expect(id).toEqual(expect.any(String));
        expect(await storedComment(db, id)).toMatchObject({
          userId: account.id,
          sectionId: community.section.id,
          body,
          status: "active",
          parentId: null,
          rootId: id,
          isAnonymous: false,
        });
        await expectOtherComments(db, before, id);
        const card = page.locator(`#comment-${id}`);
        await expect(card).toBeVisible();
        await expect(
          card.getByText(account.name, { exact: true }),
        ).toBeVisible();
        await expect(card.getByText(body, { exact: true })).toBeVisible();
        await expectToast(page, /评论已发布|Comment posted/i);
        await captureStepScreenshot(page, testInfo, "section/comment-posted");
      },
    );
  });

  test("可对他人评论点赞且不会获得其编辑删除入口", async ({
    commentRun,
    page,
    account,
    community,
    isolatedWorker,
  }, testInfo) => {
    await commentRun(
      { writes: ["reaction"], auditActions: { comment_react: 1 } },
      async () => {
        const { db, foreign } = await seedSectionComments({
          account,
          community,
          isolatedWorker,
        });
        const before = await commentRows(db);
        await openSectionComments(
          page,
          isolatedWorker.origin,
          community.section.jwId,
        );
        const card = page.locator(`#comment-${foreign.id}`);
        await expect(card).toBeVisible();
        await expectNoOwnershipActions(page, card);
        const response = await observeAction(
          () =>
            commentResponse(
              page,
              "POST",
              `/api/community/comments/${foreign.id}/reactions`,
            ),
          async () => {
            await card.getByRole("button", { name: /表情|Reactions/i }).click();
            await page
              .getByRole("menuitemcheckbox", { name: /点赞|Upvote/i })
              .click();
          },
        );
        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual({ success: true });
        expect(await storedComment(db, foreign.id)).toEqual({
          ...foreign,
          reactions: [
            {
              id: expect.any(String),
              commentId: foreign.id,
              userId: account.id,
              type: "upvote",
              createdAt: expect.any(Date),
            },
          ],
        });
        await expectOtherComments(db, before, foreign.id);
        await expect(card.getByRole("button", { name: /👍.*1/ })).toBeVisible();
        await expectToast(page, /表情已更新|Reaction updated/i);
        await expectNoOwnershipActions(page, card);
        await captureStepScreenshot(page, testInfo, "section/comment-upvoted");
      },
    );
  });

  test("编辑评论会展示提交时的编辑时间并保留原发布时间", async ({
    commentRun,
    page,
    account,
    community,
    isolatedWorker,
  }, testInfo) => {
    await commentRun(
      { writes: ["edit"], auditActions: { comment_edit: 1 } },
      async () => {
        const { db, comment } = await seedSectionComments({
          account,
          community,
          isolatedWorker,
        });
        const before = await commentRows(db);
        await openSectionComments(
          page,
          isolatedWorker.origin,
          community.section.jwId,
        );
        const card = page.locator(`#comment-${comment.id}`);
        await expect(card.getByText(/^Edited /)).toHaveCount(0);
        await expect(
          card.locator(`a[href="#comment-${comment.id}"]`),
        ).toHaveText("Feb 4, 2026, 10:23 AM");
        await card.hover();
        await card.getByRole("button", { name: /编辑|Edit/i }).click();
        const editor = card.getByRole("textbox", {
          name: /编辑评论内容|Edit comment body/i,
        });
        await expect(editor).toBeVisible();
        const body = "Independently edited section comment";
        await editor.fill(body);
        const startedAt = Date.now();
        const response = await observeAction(
          () =>
            commentResponse(
              page,
              "PATCH",
              `/api/community/comments/${comment.id}`,
            ),
          () => card.getByRole("button", { name: /保存|Save/i }).click(),
        );
        expect(response.status()).toBe(200);
        const payload = await response.json();
        expect(payload).toMatchObject({
          success: true,
          comment: { id: comment.id, body },
        });
        const saved = await db.comment.findUniqueOrThrow({
          where: { id: comment.id },
          include: { reactions: true },
        });
        expect(saved).toEqual({
          ...comment,
          body,
          updatedAt: expect.any(Date),
          reactions: [],
        });
        expect(saved.updatedAt.getTime()).toBeGreaterThanOrEqual(startedAt);
        expect(saved.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
        expect(new Date(payload.comment.updatedAt)).toEqual(saved.updatedAt);
        await expectOtherComments(db, before, comment.id);
        await expect(card.getByText(body, { exact: true })).toBeVisible();
        await expect(card.getByText(comment.body, { exact: true })).toHaveCount(
          0,
        );
        const edited = card.getByText(/^Edited /);
        await expect(edited).toBeVisible();
        await expect(edited).toHaveText(
          `Edited ${new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Shanghai",
            dateStyle: "medium",
            timeStyle: "short",
          }).format(saved.updatedAt)}`,
        );
        await expect(
          card.locator(`a[href="#comment-${comment.id}"]`),
        ).toHaveText("Feb 4, 2026, 10:23 AM");
        await expectToast(page, /评论已更新|Comment updated/i);
        await captureStepScreenshot(page, testInfo, "section/comment-edited");
      },
    );
  });

  test("可回复他人评论且回复归属于回复者", async ({
    commentRun,
    page,
    account,
    community,
    isolatedWorker,
  }, testInfo) => {
    await commentRun(
      { writes: ["create"], auditActions: { comment_create: 1 } },
      async () => {
        const { db, foreign } = await seedSectionComments({
          account,
          community,
          isolatedWorker,
        });
        const before = await commentRows(db);
        await openSectionComments(
          page,
          isolatedWorker.origin,
          community.section.jwId,
        );
        const card = page.locator(`#comment-${foreign.id}`);
        await expectNoOwnershipActions(page, card);
        await card.getByRole("button", { name: /回复|Reply/i }).click();
        const textbox = card.getByRole("textbox", {
          name: /回复内容|Reply body/i,
        });
        await expect(textbox).toBeVisible();
        const body = "Independently published reply";
        await textbox.fill(body);
        const editor = textbox.locator(
          "xpath=ancestor::*[@data-slot='field-group'][1]",
        );
        const response = await observeAction(
          () => commentResponse(page, "POST", "/api/community/comments"),
          () => editor.getByRole("button", { name: /回复|Reply/i }).click(),
        );
        expect(response.status()).toBe(201);
        const { id } = await response.json();
        expect(id).toEqual(expect.any(String));
        expect(await storedComment(db, id)).toMatchObject({
          userId: account.id,
          sectionId: community.section.id,
          body,
          parentId: foreign.id,
          rootId: foreign.id,
          status: "active",
        });
        await expectOtherComments(db, before, id);
        await expect(
          page.locator(`#comment-${id}`).getByText(body, { exact: true }),
        ).toBeVisible();
        await expectToast(page, /回复已发布|Reply posted/i);
        await expectNoOwnershipActions(page, card);
        await captureStepScreenshot(page, testInfo, "section/comment-replied");
      },
    );
  });

  test("删除评论需二次确认，取消不产生任何影响", async ({
    commentRun,
    commentFlow,
    page,
    account,
    community,
    isolatedWorker,
  }, testInfo) => {
    await commentRun(
      { writes: ["delete"], auditActions: { comment_delete: 1 } },
      async () => {
        const { db, comment, foreign } = await seedSectionComments({
          account,
          community,
          isolatedWorker,
        });
        const reply = await db.comment.create({
          data: {
            userId: foreign.userId,
            sectionId: community.section.id,
            parentId: comment.id,
            rootId: comment.id,
            body: "Preserved reply to deleted root",
            createdAt: seededEditedAt,
            updatedAt: seededEditedAt,
          },
        });
        await db.commentReaction.create({
          data: {
            userId: account.id,
            commentId: comment.id,
            type: "upvote",
          },
        });
        const before = await commentRows(db);
        const prior = await storedComment(db, comment.id);
        await openCommentPermalink(page, isolatedWorker.origin, comment.id);
        const card = page.locator(`#comment-${comment.id}`);
        const dialog = await openCommentDeleteDialog(page, card);
        const buttons = dialog.locator(
          '[data-slot="alert-dialog-footer"] button',
        );
        await expect(buttons).toHaveCount(2);
        await expect(buttons.nth(0)).toHaveAttribute(
          "data-slot",
          "alert-dialog-cancel",
        );
        await expect(buttons.nth(1)).toHaveAttribute(
          "data-slot",
          "alert-dialog-action",
        );
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        expect(await commentRows(db)).toEqual(before);
        const canceled = await openCommentDeleteDialog(page, card);
        await canceled.getByRole("button", { name: /取消|Cancel/i }).click();
        await expect(canceled).toBeHidden();
        expect(await commentRows(db)).toEqual(before);
        const pending = await openCommentDeleteDialog(page, card);
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        commentFlow.onClosing(() => release());
        await commentFlow.route(
          page,
          `**/api/community/comments/${comment.id}`,
          async (route: Route) => {
            if (route.request().method() === "DELETE") await gate;
            await route.fallback();
          },
        );
        try {
          const response = await observeAction(
            () =>
              commentResponse(
                page,
                "DELETE",
                `/api/community/comments/${comment.id}`,
              ),
            async () => {
              try {
                await pending
                  .getByRole("button", { name: /删除|Delete/i })
                  .click();
                await expect(pending).toBeVisible();
                await expect(
                  pending.getByRole("button", { name: /删除|Delete/i }),
                ).toBeDisabled();
                await expect(
                  pending.getByRole("button", { name: /取消|Cancel/i }),
                ).toBeDisabled();
                await expect(
                  pending.locator('[data-icon="inline-start"]'),
                ).toBeVisible();
                expect(await commentRows(db)).toEqual(before);
              } finally {
                release();
              }
            },
          );
          expect(response.status()).toBe(200);
          expect(await response.json()).toEqual({ success: true });
          expect(await storedComment(db, comment.id)).toEqual({
            ...prior,
            status: "deleted",
            deletedAt: expect.any(Date),
            updatedAt: expect.any(Date),
          });
          await expectOtherComments(db, before, comment.id);
          expect(
            await db.comment.findUnique({ where: { id: reply.id } }),
          ).toEqual(reply);
          await expect(pending).toBeHidden();
          await expectToast(page, /评论已删除|Comment deleted/i);
          await expect(
            page.getByText(comment.body, { exact: true }),
          ).toHaveCount(0);
          await captureStepScreenshot(
            page,
            testInfo,
            "section/comment-deleted",
          );
        } finally {
          release();
          await commentFlow.clearRoutes(page);
        }
      },
    );
  });

  test("已知评论线程对作者、他人与匿名读者的投影", async ({
    commentRun,
    commentFlow,
    page,
    account,
    community,
    isolatedWorker,
  }) => {
    await commentRun({ writes: [], auditActions: {} }, async () => {
      const { db, comment, foreign } = await seedSectionComments({
        account,
        community,
        isolatedWorker,
      });
      const reply = await db.$transaction(async (tx) => {
        await tx.comment.update({
          where: { id: comment.id },
          data: {
            body: "Known edited share comment",
            updatedAt: seededEditedAt,
          },
        });
        await tx.commentReaction.create({
          data: {
            userId: account.id,
            commentId: comment.id,
            type: "upvote",
          },
        });
        return tx.comment.create({
          data: {
            userId: foreign.userId,
            sectionId: community.section.id,
            parentId: comment.id,
            rootId: comment.id,
            body: "Known share reply",
            createdAt: seededEditedAt,
            updatedAt: seededEditedAt,
          },
        });
      });
      if (!foreign.userId)
        throw new Error("The seeded other author must have a user");
      const otherAuthorId = foreign.userId;
      const before = await commentRows(db);
      const thread = {
        author: account.name,
        canonicalUrl: `${isolatedWorker.origin}/catalog/sections/${community.section.jwId}#comment-${comment.id}`,
        commentId: comment.id,
        otherRootBody: foreign.body,
        otherRootId: foreign.id,
        replyId: reply.id,
      };

      // The author reads on the page that already owns its session; the reload
      // keeps the rendered timestamps and controls stable across a second load.
      await openCommentPermalink(page, isolatedWorker.origin, comment.id);
      await expectKnownThread(page, "author", thread);
      await page.reload();
      await waitForUiSettled(page);
      await expectKnownThread(page, "author", thread);

      // Every other identity reads in its own context, so no cookie is shared.
      const otherSession = await isolatedWorker.createSession(otherAuthorId);
      for (const viewer of ["other", "anonymous"] as const) {
        const context = await commentFlow.newContext();
        try {
          if (viewer === "other")
            await context.addCookies([otherSession.cookie]);
          const reader = await context.newPage();
          await openCommentPermalink(reader, isolatedWorker.origin, comment.id);
          await expectKnownThread(reader, viewer, thread);
        } finally {
          await commentFlow.closeContext(context);
        }
      }
      expect(await commentRows(db)).toEqual(before);
    });
  });

  test("匿名评论复选框会隐藏评论者身份", async ({
    commentRun,
    page,
    account,
    community,
    isolatedWorker,
  }, testInfo) => {
    await commentRun(
      { writes: ["create"], auditActions: { comment_create: 1 } },
      async () => {
        const { db } = await seedSectionComments({
          account,
          community,
          isolatedWorker,
        });
        const before = await commentRows(db);
        const body = "Independently published anonymous comment";
        await openSectionComments(
          page,
          isolatedWorker.origin,
          community.section.jwId,
        );
        const comments = page.locator("#comments");
        const composer = await openCommentComposer(page, comments);
        const anonymous = comments
          .getByRole("checkbox", { name: /匿名|Anonymous/i })
          .first();
        await expect(anonymous).toBeVisible();
        await anonymous.click();
        await expect(anonymous).toHaveAttribute("aria-checked", "true");
        await composer.fill(body);
        const response = await observeAction(
          () => commentResponse(page, "POST", "/api/community/comments"),
          () =>
            comments
              .getByRole("button", { name: /发布评论|Post comment/i })
              .click(),
        );
        expect(response.status()).toBe(201);
        const { id } = await response.json();
        expect(id).toEqual(expect.any(String));
        expect(await storedComment(db, id)).toMatchObject({
          userId: account.id,
          sectionId: community.section.id,
          body,
          status: "active",
          isAnonymous: true,
        });
        await expectOtherComments(db, before, id);
        await expectAnonymousCard(
          page.locator(`#comment-${id}`),
          account.name,
          body,
        );
        await captureStepScreenshot(
          page,
          testInfo,
          "section/comment-anonymous-author",
        );
      },
    );
  });

  test("已存匿名评论对退出登录的读者隐藏作者身份", async ({
    commentRun,
    page,
    account,
    community,
    isolatedWorker,
  }, testInfo) => {
    await commentRun({ writes: [], auditActions: {} }, async () => {
      const { db, comment } = await seedSectionComments({
        account,
        community,
        isolatedWorker,
      });
      await db.comment.update({
        where: { id: comment.id },
        data: { isAnonymous: true, updatedAt: seededAt },
      });
      const before = await commentRows(db);
      await page.context().clearCookies();
      await openSectionComments(
        page,
        isolatedWorker.origin,
        community.section.jwId,
      );
      await expectAnonymousCard(
        page.locator(`#comment-${comment.id}`),
        account.name,
        comment.body,
      );
      expect(await commentRows(db)).toEqual(before);
      await captureStepScreenshot(
        page,
        testInfo,
        "section/comment-anonymous-masked",
      );
    });
  });

  uploadTest(
    "upload.three-step-upload",
    async (
      {
        page,
        account,
        community,
        upload,
        isolatedWorker,
        commentRun,
        commentFlow,
      },
      testInfo,
    ) => {
      await commentRun(
        {
          writes: [
            "upload-reserve",
            "upload-object",
            "upload-complete",
            "create",
          ],
          auditActions: { comment_create: 1 },
        },
        async () => {
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
          const [
            uploadCreateResponse,
            uploadPutResponse,
            uploadCompleteResponse,
          ] = await observeAction(
            async () => {
              const outcomes = await Promise.allSettled([
                page.waitForResponse(
                  (r) =>
                    new URL(r.url()).pathname === "/api/workspace/uploads" &&
                    r.request().method() === "POST" &&
                    r.status() === 200,
                ),
                page.waitForResponse(
                  (r) =>
                    r.request().method() === "PUT" &&
                    r.status() >= 200 &&
                    r.status() < 300 &&
                    new URL(r.url()).origin === new URL(page.url()).origin &&
                    new URL(r.url()).pathname ===
                      "/api/workspace/uploads/object",
                ),
                page.waitForResponse(
                  (r) =>
                    r.url().includes("/api/workspace/uploads/complete") &&
                    r.request().method() === "POST" &&
                    r.status() === 200,
                ),
              ]);
              const failures = outcomes.flatMap((outcome) =>
                outcome.status === "rejected" ? [outcome.reason] : [],
              );
              if (failures.length)
                throw new AggregateError(
                  failures,
                  "Upload response observations failed",
                );
              return outcomes.map((outcome) => {
                if (outcome.status === "rejected") throw outcome.reason;
                return outcome.value;
              });
            },
            async () => {
              await comments.locator('input[type="file"]').setInputFiles({
                name: filename,
                mimeType: "text/plain",
                buffer: Buffer.from(contents),
              });
            },
          );
          const session = await uploadCreateResponse.json();
          expect(new URL(session.url).origin).toBe(new URL(page.url()).origin);
          expect(uploadPutResponse.url()).toBe(session.url);
          expect(new URL(session.url).searchParams.get("key")).toBe(
            session.key,
          );
          expect(uploadCompleteResponse.request().postDataJSON()).toMatchObject(
            {
              key: session.key,
              filename,
            },
          );
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
          const createCommentResponse = await observeAction(
            () =>
              page.waitForResponse(
                (r) =>
                  r.url().includes("/api/community/comments") &&
                  r.request().method() === "POST" &&
                  r.status() === 201,
              ),
            async () => {
              await postButton.click();
            },
          );
          const createCommentBody = (await createCommentResponse.json()) as {
            id: string;
          };
          expect(typeof createCommentBody.id).toBe("string");
          const commentId = createCommentBody.id;
          await waitForUiSettled(page);
          expect(
            await storedComment(isolatedWorker.database.owner, commentId),
          ).toMatchObject({
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
          await captureStepScreenshot(
            page,
            testInfo,
            "section/comment-attachment",
          );

          // Download is served by the authorized on-site R2 streaming route.
          const popup = await observeAction(
            () => page.waitForEvent("popup"),
            async () => {
              await commentCard
                .getByRole("link", { name: /打开附件|Open attachment/i })
                .first()
                .click();
            },
          );
          await popup.waitForLoadState("domcontentloaded");
          await expect(popup).toHaveURL(
            /\/api\/workspace\/uploads\/.*\/download/,
          );
          await commentFlow.closePage(popup);
          const download = await page.request.get(
            `/api/workspace/uploads/${uploadId}/download`,
          );
          expect(download.status()).toBe(200);
          expect(await download.text()).toBe(contents);
          expect((await upload.observe()).objects).toEqual([
            { key: session.key, body: Array.from(Buffer.from(contents)) },
          ]);
        },
      );
    },
  );

  test("删除带附件的评论保留已存储对象", async ({
    commentRun,
    page,
    account,
    community,
    isolatedWorker,
    upload,
    uploadBucket,
  }) => {
    await commentRun(
      { writes: ["delete"], auditActions: { comment_delete: 1 } },
      async () => {
        const { db, comment } = await seedSectionComments({
          account,
          community,
          isolatedWorker,
        });
        const key = `uploads/${account.id}/${crypto.randomUUID()}`;
        const contents = "Independently seeded attachment bytes";
        await uploadBucket.put(key, contents, {
          httpMetadata: { contentType: "text/plain" },
        });
        await db.upload.create({
          data: {
            key,
            userId: account.id,
            filename: "seeded-section-attachment.txt",
            size: Buffer.byteLength(contents),
            contentType: "text/plain",
            commentAttachments: { create: { commentId: comment.id } },
          },
        });
        const before = await commentRows(db);
        const files = await upload.observe();
        await openSectionComments(
          page,
          isolatedWorker.origin,
          community.section.jwId,
        );
        const card = page.locator(`#comment-${comment.id}`);
        await expect(
          card.getByRole("link", { name: /打开附件|Open attachment/i }),
        ).toBeVisible();
        const dialog = await openCommentDeleteDialog(page, card);
        const response = await observeAction(
          () =>
            commentResponse(
              page,
              "DELETE",
              `/api/community/comments/${comment.id}`,
            ),
          () => dialog.getByRole("button", { name: /删除|Delete/i }).click(),
        );
        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual({ success: true });
        expect(await storedComment(db, comment.id)).toEqual({
          ...comment,
          reactions: [],
          status: "deleted",
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        await expectOtherComments(db, before, comment.id);
        // Comment deletion is a tombstone; the private fixture owns eventual object disposal.
        expect(await upload.observe()).toEqual(files);
        await expect(card).toHaveCount(0);
        await expectToast(page, /评论已删除|Comment deleted/i);
      },
    );
  });
});
