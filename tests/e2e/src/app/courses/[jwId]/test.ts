/**
 * E2E tests for `/catalog/courses/[jwId]` — Individual Course Detail page.
 *
 * ## Data Represented (course.yml → course-detail.display.fields)
 * - course.namePrimary (h1 title)
 * - course.nameSecondary (locale-dependent subtitle)
 * - course.code (plain monospace text)
 * - course.educationLevel.namePrimary
 * - course.category.namePrimary
 * - course.classType.namePrimary
 * - section.semester.nameCn (semester column)
 * - section.code (plain monospace text)
 * - section.teachers[].namePrimary + nameSecondary
 * - section.campus.namePrimary
 * - section.stdCount / section.limitCount (capacity)
 * - description.content (Markdown-rendered via DescriptionLoader)
 *
 * ## Rules
 * - course.jwId is NOT displayed in ordinary course UI (jwid-url-only rule)
 *
 * ## Edge cases
 * - Invalid jwId → 404
 * - Description edit requires authentication
 * - Comment CRUD: post → edit → delete
 */
import { expect, test } from "@playwright/test";
import scenarioData from "../../../../fixtures/scenario.json" with {
  type: "json",
};
import {
  arrangeDescription,
  test as communityTest,
  storedComment,
  storedDescription,
  storedDescriptionAudits,
  supplement,
} from "../../../../utils/catalog-browser-fixture";
import { openCommentComposer } from "../../../../utils/comments";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

const COURSE_URL = `/catalog/courses/${DEV_SEED.course.jwId}`;
const COURSE_WITH_DESCRIPTION_URL = `/catalog/courses/${scenarioData.courses[2].jwId}#introduction`;
const COURSE_WITH_DESCRIPTION_TEXT = "实验课建议准备护目镜并提前完成预习问答。";

async function jumpToCourseSection(
  page: Parameters<typeof gotoAndWaitForReady>[0],
  name: RegExp,
  selector: string,
) {
  const hash = selector.replace(/^#/, "");
  if (hash === "sections" || hash === "comments" || hash === "introduction") {
    await gotoAndWaitForReady(
      page,
      `${COURSE_URL}${hash === "introduction" ? "#introduction" : `#${hash}`}`,
    );
    await expect(page.locator(selector)).toBeVisible();
    return;
  }

  const heading = page.getByRole("heading", { name }).first();
  await expect(heading).toBeVisible();
  await heading.scrollIntoViewIfNeeded();
  await expect(page.locator(selector)).toBeVisible();
}

test.describe("/catalog/courses/[jwId] 课程详情", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/catalog/courses/[jwId]",
      testInfo,
    });
  });

  test("无效参数返回 404", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/courses/999999999", {
      expectMainContent: false,
    });
    await expect(page.getByText("404").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "course/404");
  });

  // ── Display fields ──────────────────────────────────────────────────────────

  test("显示课程名称、代码和基本信息", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);

    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toContainText(
      new RegExp(`${DEV_SEED.course.nameCn}|${DEV_SEED.course.nameEn}`),
    );
    await expect(heading).toContainText(DEV_SEED.course.nameCn);
    await expect(heading).toContainText(DEV_SEED.course.nameEn);
    // The public code belongs to the title region, separate from section codes.
    const courseCode = page.getByTestId("course-public-code");
    await expect(courseCode).toBeVisible();

    await captureStepScreenshot(page, testInfo, "course/heading-and-code");
  });

  test("显示培养层次、课程类别和教学班类型", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);

    // course.educationLevel.namePrimary (locale-dependent)
    await expect(
      page
        .getByText(DEV_SEED.course.educationLevelNameCn)
        .or(page.getByText(DEV_SEED.course.educationLevelNameEn))
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    // course.category.namePrimary (locale-dependent)
    await expect(
      page
        .getByText(DEV_SEED.course.categoryNameCn)
        .or(page.getByText(DEV_SEED.course.categoryNameEn))
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    // course.classType.namePrimary (locale-dependent)
    await expect(
      page
        .getByText(DEV_SEED.course.classTypeNameCn)
        .or(page.getByText(DEV_SEED.course.classTypeNameEn))
        .filter({ visible: true })
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "course/basic-info");
  });

  test("班级表格显示学期、班级代码、教师、校区和容量", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);
    await jumpToCourseSection(page, /班级|Sections/i, "#sections");

    // The upstream Chinese term name is localized for the active page locale.
    const locale = await page.locator("html").getAttribute("lang");
    await expect(
      visibleText(
        page,
        locale === "en-us" ? "Spring 2026" : DEV_SEED.semesterNameCn,
      ),
    ).toBeVisible();
    // section.code (plain monospace text)
    await expect(
      page
        .locator('table:visible [data-slot="catalog-code"]')
        .filter({ hasText: DEV_SEED.section.code })
        .first(),
    ).toBeVisible();
    // section.teachers[].namePrimary (locale-dependent)
    await expect(
      page
        .getByText(DEV_SEED.teacher.nameCn)
        .or(page.getByText(DEV_SEED.teacher.nameEn))
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    // section.campus.namePrimary (locale-dependent)
    await expect(
      page
        .getByText(DEV_SEED.campus.nameCn)
        .or(page.getByText(DEV_SEED.campus.nameEn))
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    // section.stdCount / section.limitCount
    await expect(
      visibleText(
        page,
        `${DEV_SEED.section.stdCount} / ${DEV_SEED.section.limitCount}`,
      ),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "course/sections-table");
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test("详情流式布局包含主要锚点区块", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);

    await expect(page.locator("#introduction")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /授课班级|Teaching Sections/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /评论|Comments/i }),
    ).toBeVisible();

    await gotoAndWaitForReady(page, `${COURSE_URL}#comments`);
    await expect(page).toHaveURL(/\/catalog\/courses\/\d+#comments$/);
    await expect(page.locator("#comments")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "course/detail-nav");
  });

  test("ui.detail-hero-5", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, COURSE_URL);

    const heading = page.getByRole("heading", { level: 1 }).first();
    const courseCode = page.getByTestId("course-public-code");
    await expect(heading).toHaveCSS("font-size", "24px");
    await expect(courseCode).toBeInViewport();
    const codeBox = await courseCode.boundingBox();
    const titleBox = await heading.boundingBox();
    expect(codeBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    if (!codeBox || !titleBox) throw new Error("Missing course title geometry");
    expect(codeBox.y + codeBox.height).toBeLessThanOrEqual(titleBox.y);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);

    await gotoAndWaitForReady(page, `${COURSE_URL}#comments`);
    await expect(page.locator("#comments")).toBeVisible();

    await captureStepScreenshot(page, testInfo, "course/detail-mobile");
  });

  test("班级行链接到班级详情", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);
    await jumpToCourseSection(page, /班级|Sections/i, "#sections");
    const sectionLink = page
      .locator(`a[href="/catalog/sections/${DEV_SEED.section.jwId}"]:visible`)
      .or(page.locator("tbody a[href^='/catalog/sections/']:visible"))
      .first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();
    await expect(page).toHaveURL(/\/catalog\/sections\/\d+/);
    await captureStepScreenshot(page, testInfo, "course/section-link");
  });

  // ── Description ─────────────────────────────────────────────────────────────

  test("同路由导航重置目标范围内的简介状态", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_WITH_DESCRIPTION_URL);
    await expect(page.getByText(COURSE_WITH_DESCRIPTION_TEXT)).toBeVisible();

    await page.evaluate((href) => {
      const link = document.createElement("a");
      link.href = href;
      link.dataset.e2eSameRouteLink = "true";
      link.textContent = "same-route target";
      document.querySelector("#main-content")?.prepend(link);
    }, COURSE_URL);

    await page.locator("[data-e2e-same-route-link]").click();
    await expect(page).toHaveURL(new RegExp(`${COURSE_URL}$`));
    await expect(visibleText(page, DEV_SEED.course.code)).toBeVisible();
    await expect(page.getByText(COURSE_WITH_DESCRIPTION_TEXT)).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "course/same-route-reset");
  });

  communityTest(
    "登录用户可以编辑课程简介",
    async ({ page, account, community, communityFlow }, testInfo) => {
      await communityFlow.run(
        async () => {
          const description = await arrangeDescription(
            community.db,
            "course",
            community.course.id,
            account.id,
          );
          await gotoAndWaitForReady(
            page,
            `/catalog/courses/${community.course.jwId}#introduction`,
          );
          const introduction = page.locator("#introduction");
          await expect(introduction).toBeVisible();

          const content = `e2e-course-desc-${Date.now()}`;
          const editor = introduction.locator(
            '[data-slot="markdown-editor"] textarea',
          );
          const editButton = introduction.getByTestId("description-edit");
          await expect(editButton).toBeVisible({ timeout: 60_000 });
          await editButton.scrollIntoViewIfNeeded();
          await editButton.click();
          await expect(editor).toBeVisible();
          await editor.fill(content);
          await introduction
            .getByRole("tab", { name: /预览|Preview/i })
            .click();
          await expect(
            introduction
              .getByRole("tabpanel", { name: /预览|Preview/i })
              .getByText(content),
          ).toBeVisible();

          const saveResponse = page.waitForResponse(
            (r) =>
              r.url().includes("/api/community/descriptions") &&
              r.request().method() === "POST" &&
              r.status() === 200,
          );
          await introduction
            .getByRole("button", { name: /保存|Save/i })
            .click();
          await saveResponse;
          await expect(
            introduction
              .getByRole("tabpanel", { name: /简介|Description/i })
              .getByText(content),
          ).toBeVisible();

          const historyTab = introduction.getByRole("tab", {
            name: /编辑记录|Edit History/i,
          });
          await expect(historyTab).toBeVisible();
          await expect(historyTab).toBeEnabled();
          await historyTab.click();
          await expect(historyTab).toHaveAttribute("aria-selected", "true");
          const historyPanel = introduction.getByRole("tabpanel", {
            name: /编辑记录|Edit History/i,
          });
          await expect(historyPanel).toBeVisible();
          await expect(historyPanel.getByText(content)).toBeVisible();
          await expect(
            historyPanel.getByText(/之前|Previous/i).first(),
          ).toBeVisible();
          await expect(
            historyPanel.getByText(/更新后|Updated/i).first(),
          ).toBeVisible();
          await captureStepScreenshot(
            page,
            testInfo,
            "course/description-updated",
          );
          const persisted = await storedDescription(
            community.db,
            description.id,
          );
          expect(persisted).toMatchObject({
            content,
            lastEditedById: account.id,
            lastEditedAt: expect.any(Date),
          });
          expect(persisted?.edits).toEqual([
            expect.objectContaining({
              editorId: account.id,
              previousContent: supplement,
              nextContent: content,
            }),
          ]);
          await expect
            .poll(() => storedDescriptionAudits(community.db, description.id))
            .toEqual([
              expect.objectContaining({
                userId: account.id,
                action: "description_edit",
                outcome: "success",
              }),
            ]);
          await page.reload();
          await expect(
            introduction
              .getByRole("tabpanel", { name: /简介|Description/i })
              .getByText(content),
          ).toBeVisible();
        },
        { auditActions: { description_edit: 1 }, catalogPurges: 1 },
      );
    },
  );

  // ── Comment CRUD ─────────────────────────────────────────────────────────────

  communityTest(
    "登录用户可以发布、编辑和删除评论",
    async ({ page, account, community, communityFlow }, testInfo) => {
      await communityFlow.run(
        async () => {
          await gotoAndWaitForReady(
            page,
            `/catalog/courses/${community.course.jwId}#comments`,
          );
          await expect(page).toHaveURL(/\/catalog\/courses\/\d+#comments$/);
          const body = `e2e-course-comment-${Date.now()}`;
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
          const commentId = createResponseBody.id;
          expect(await storedComment(community.db, commentId)).toMatchObject({
            userId: account.id,
            courseId: community.course.id,
            body,
            isAnonymous: false,
            status: "active",
          });

          const commentCard = page
            .locator('[id^="comment-"]')
            .filter({ hasText: body })
            .first();
          await expect(commentCard).toBeVisible();
          await expect(
            page
              .locator("[data-sonner-toast]")
              .filter({ hasText: /评论已发布|Comment posted/i }),
          ).toBeVisible();
          // comment.author.name visible
          await expect(
            commentCard.getByText(account.name).first(),
          ).toBeVisible();
          await captureStepScreenshot(page, testInfo, "course/comment-posted");

          // Edit
          await commentCard.hover();
          await commentCard.getByRole("button", { name: /编辑|Edit/i }).click();
          const editedBody = `${body}-edited`;
          const editCard = page
            .locator('[id^="comment-"]')
            .filter({ has: page.locator(".sr-only", { hasText: body }) })
            .first();
          await expect(editCard.locator("textarea").first()).toBeVisible();
          await editCard.locator("textarea").first().fill(editedBody);
          const editResponse = page.waitForResponse(
            (r) =>
              r.url().includes("/api/community/comments/") &&
              r.request().method() === "PATCH" &&
              r.status() === 200,
          );
          await editCard.getByRole("button", { name: /保存|Save/i }).click();
          await editResponse;
          expect(await storedComment(community.db, commentId)).toMatchObject({
            body: editedBody,
            userId: account.id,
            status: "active",
          });
          await expect(page.getByText(editedBody).first()).toBeVisible();
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

          // The share route and a reload consume the persisted edit.
          await gotoAndWaitForReady(page, `/community/comments/${commentId}`);
          await expect(editedCommentCard).toContainText(editedBody);
          await page.reload();
          await expect(editedCommentCard).toContainText(editedBody);

          // Delete
          await editedCommentCard.hover();
          await editedCommentCard
            .getByRole("button", { name: /更多操作|More actions/i })
            .first()
            .click();
          const deleteResponse = page.waitForResponse(
            (r) =>
              r.url().includes("/api/community/comments/") &&
              r.request().method() === "DELETE" &&
              r.status() === 200,
          );
          await page.getByRole("menuitem", { name: /删除|Delete/i }).click();
          const dialog = page.getByRole("alertdialog", {
            name: /删除评论|Delete Comment/i,
          });
          await expect(dialog).toBeVisible();
          await dialog.getByRole("button", { name: /删除|Delete/i }).click();
          await deleteResponse;
          expect(await storedComment(community.db, commentId)).toMatchObject({
            status: "deleted",
            deletedAt: expect.any(Date),
          });
          await expect(
            page
              .locator("[data-sonner-toast]")
              .filter({ hasText: /评论已删除|Comment deleted/i }),
          ).toBeVisible();
          await expect(page.locator(`#comment-${commentId}`)).toHaveCount(0);
          await captureStepScreenshot(page, testInfo, "course/comment-deleted");
        },
        {
          auditActions: {
            comment_create: 1,
            comment_edit: 1,
            comment_delete: 1,
          },
        },
      );
    },
  );
});

test.describe("/catalog/courses/[jwId]/introduction 无 JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("SSR 保留 sanitized Markdown 简介", async ({ page }) => {
    await page.goto(COURSE_WITH_DESCRIPTION_URL);

    await expect(page.getByText(COURSE_WITH_DESCRIPTION_TEXT)).toBeVisible();
    await expect(page.locator("#introduction .markdown-preview")).toBeVisible();
  });
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, {
    routePath: "/catalog/courses/[jwId]/[section]",
    testInfo,
  });
});
