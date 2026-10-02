import {
  arrangeCourseIntroduction,
  test,
} from "../../../../utils/catalog-detail-fixture";
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

import { expect } from "@playwright/test";
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
import { observeAction } from "../../../../utils/observed-action";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { assertPageContract } from "../../_shared/page-contract";

const COURSE_URL = `/catalog/courses/${DEV_SEED.course.jwId}`;
const COURSE_WITH_DESCRIPTION_URL = `/catalog/courses/${scenarioData.courses[2].jwId}#introduction`;
const COURSE_WITH_DESCRIPTION_TEXT = "实验课建议准备护目镜并提前完成预习问答。";

test.describe("/catalog/courses/[jwId] 课程详情", () => {
  test("页面契约", async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
  }) => {
    await preferenceFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/catalog/courses/[jwId]",
      });
    });
  });

  test("无效参数返回 404", async ({ page, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, "/catalog/courses/999999999", {
        expectMainContent: false,
      });
      await expect(page.getByText("404").first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
      ).toBeVisible();
    });
  });

  // ── Display fields ──────────────────────────────────────────────────────────

  test("显示课程名称、代码和基本信息", async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
  }) => {
    await preferenceFlow.run(async () => {
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
    });
  });

  test("显示培养层次、课程类别和教学班类型", async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
  }) => {
    await preferenceFlow.run(async () => {
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
    });
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test("详情流式布局包含主要锚点区块", async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
  }) => {
    await preferenceFlow.run(async () => {
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
    });
  });

  test("ui.detail-hero-5", async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
  }) => {
    await preferenceFlow.run(async () => {
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
      if (!codeBox || !titleBox)
        throw new Error("Missing course title geometry");
      expect(codeBox.y + codeBox.height).toBeLessThanOrEqual(titleBox.y);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);

      await gotoAndWaitForReady(page, `${COURSE_URL}#comments`);
      await expect(page.locator("#comments")).toBeVisible();
    });
  });

  // ── Description ─────────────────────────────────────────────────────────────

  test("同路由导航重置目标范围内的简介状态", async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
    isolatedWorker,
  }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction(arrangeCourseIntroduction),
    );
    await preferenceFlow.run(async () => {
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
    });
  });

  communityTest(
    "登录用户可以编辑课程简介",
    async ({ page, account, community, communityFlow }) => {
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

          await observeAction(
            () =>
              page.waitForResponse(
                (r) =>
                  r.url().includes("/api/community/descriptions") &&
                  r.request().method() === "POST" &&
                  r.status() === 200,
              ),
            () =>
              introduction.getByRole("button", { name: /保存|Save/i }).click(),
          );
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

  // ── Comment creation on the course target ────────────────────────────────────

  communityTest(
    "登录用户发布的评论绑定到课程目标",
    async ({ page, account, community, communityFlow }) => {
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
          const createdCommentResponse = await observeAction(
            () =>
              page.waitForResponse(
                (r) =>
                  r.url().includes("/api/community/comments") &&
                  r.request().method() === "POST" &&
                  r.status() === 201,
              ),
            () =>
              page
                .locator("#comments")
                .getByRole("button", { name: /发布评论|Post comment/i })
                .click(),
          );
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
        },
        { auditActions: { comment_create: 1 } },
      );
    },
  );
});

test.describe("/catalog/courses/[jwId]/introduction 无 JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("SSR 保留 sanitized Markdown 简介", async ({
    preferenceFlow,
    detailCatalog: _detailCatalog,
    isolatedWorker,
  }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction(arrangeCourseIntroduction),
    );
    await preferenceFlow.run(async () => {
      const context = await preferenceFlow.newContext({
        javaScriptEnabled: false,
      });
      const page = await preferenceFlow.newPage(context);
      await page.goto(COURSE_WITH_DESCRIPTION_URL);

      await expect(page.getByText(COURSE_WITH_DESCRIPTION_TEXT)).toBeVisible();
      await expect(
        page.locator("#introduction .markdown-preview"),
      ).toBeVisible();
    });
  });
});

test("页面契约", async ({
  page,
  preferenceFlow,
  detailCatalog: _detailCatalog,
}) => {
  await preferenceFlow.run(async () => {
    await assertPageContract(page, {
      routePath: "/catalog/courses/[jwId]/[section]",
    });
  });
});
