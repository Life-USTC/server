import type { TestPrismaClient } from "../../../../../shared/prisma";
import {
  type arrangeDetailCatalog,
  test,
} from "../../../../utils/catalog-detail-fixture";
/**
 * E2E tests for /teachers/[id] — Teacher Detail Page
 *
 * ## Data Represented (teacher.yml → teacher-detail.display.fields)
 * - teacher.namePrimary (h1)
 * - teacher.nameSecondary (locale subtitle)
 * - teacher.department.namePrimary
 * - teacher.teacherTitle.namePrimary
 * - teacher.email (if not null)
 * - teacher.telephone / mobile / address (if not null)
 * - section.semester.nameCn (badge)
 * - section.course.namePrimary + nameSecondary
 * - section.code (plain monospace text)
 * - section.credits (or empty)
 * - comment.id, author.name, author.image, body, createdAt
 * - description.content (Markdown-rendered via DescriptionLoader)
 *
 * ## Rules
 * - Teacher IDs are dynamic; all tests navigate via search first
 *
 * ## Edge Cases
 * - Invalid id → 404 page
 * - Description edit requires login
 * - Comment CRUD: post → edit → delete
 */

import { expect } from "@playwright/test";
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
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { observeSectionDetailNavigation } from "../../../../utils/section-detail-navigation";
import { assertPageContract } from "../../_shared/page-contract";

async function navigateToSeedTeacher(
  page: Parameters<typeof gotoAndWaitForReady>[0],
) {
  await gotoAndWaitForReady(
    page,
    `/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}`,
  );
  const detailLink = page
    .locator("#main-content a[href^='/catalog/teachers/']:visible")
    .first();
  await expect(detailLink).toBeVisible();
  await detailLink.click();
  await expect(page).toHaveURL(/\/catalog\/teachers\/\d+/);
  await waitForUiSettled(page);
}

async function jumpToTeacherSection(
  page: Parameters<typeof gotoAndWaitForReady>[0],
  name: RegExp,
  selector: string,
) {
  const hash = selector.replace(/^#/, "");
  if (hash === "sections" || hash === "comments" || hash === "introduction") {
    await gotoAndWaitForReady(
      page,
      `${page.url().split("#")[0]}${hash === "introduction" ? "#introduction" : `#${hash}`}`,
    );
    await expect(page.locator(selector)).toBeVisible();
    return;
  }

  const heading = page.getByRole("heading", { name }).first();
  await expect(heading).toBeVisible();
  await heading.scrollIntoViewIfNeeded();
  await expect(page.locator(selector)).toBeVisible();
}

async function expectDetailCatalogUnchanged(
  db: TestPrismaClient,
  catalog: Awaited<ReturnType<typeof arrangeDetailCatalog>>,
  assignments: Awaited<
    ReturnType<TestPrismaClient["sectionTeacher"]["findMany"]>
  >,
) {
  const { course, teacher, section, semester, campus } = catalog;
  // run owns these observations after preferenceFlow drains native reads.
  expect(await db.course.findMany()).toEqual([course]);
  expect(await db.teacher.findMany()).toEqual([teacher]);
  expect(await db.semester.findMany()).toEqual([semester]);
  expect(await db.campus.findMany()).toEqual([campus]);
  expect(
    await db.section.findMany({
      include: { teachers: { select: { id: true } } },
    }),
  ).toEqual([{ ...section, teachers: [{ id: teacher.id }] }]);
  expect(await db.sectionTeacher.findMany()).toEqual(assignments);
  expect(await db.user.findMany()).toEqual([]);
  expect(await db.session.findMany()).toEqual([]);
  expect(await db.userSectionSubscription.findMany()).toEqual([]);
  expect(await db.auditLog.findMany()).toEqual([]);
}

test.describe("/catalog/teachers/[id] 教师详情页", () => {
  test("页面契约", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
  }) => {
    await preferenceFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/catalog/teachers/[id]",
      });
    });
  });

  test("无效参数返回 404", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, "/catalog/teachers/999999999", {
        expectMainContent: false,
      });
      await expect(page.getByText("404").first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
      ).toBeVisible();
    });
  });

  // ── Display fields ──────────────────────────────────────────────────────────

  test("标题中显示教师主名称", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
  }) => {
    await preferenceFlow.run(async () => {
      await navigateToSeedTeacher(page);

      // teacher.namePrimary (h1) (locale-dependent)
      await expect(
        page
          .getByRole("heading", {
            level: 1,
            name: DEV_SEED.teacher.nameCn,
          })
          .or(
            page.getByRole("heading", {
              level: 1,
              name: DEV_SEED.teacher.nameEn,
            }),
          )
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
    });
  });

  test("常规界面不显示内部教师 ID", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
  }) => {
    await preferenceFlow.run(async () => {
      await navigateToSeedTeacher(page);
      const teacherId = new URL(page.url()).pathname.split("/").pop();
      expect(teacherId).toBeTruthy();
      await expect(page.getByText(/教师 ID|Teacher ID/i)).toHaveCount(0);
      await expect(page.locator("#main-content")).not.toContainText(
        new RegExp(`(?:教师 ID|Teacher ID)\\s*${teacherId}`),
      );
    });
  });

  test("基本信息中显示院系、职称与邮箱", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
  }) => {
    await preferenceFlow.run(async () => {
      await navigateToSeedTeacher(page);

      // teacher.department.namePrimary (locale-dependent)
      await expect(
        page
          .getByText(DEV_SEED.teacher.departmentNameCn)
          .or(page.getByText(DEV_SEED.teacher.departmentNameEn))
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      // teacher.teacherTitle.namePrimary (locale-dependent)
      await expect(
        page
          .getByText(DEV_SEED.teacher.titleNameCn)
          .or(page.getByText(DEV_SEED.teacher.titleNameEn))
          .first(),
      ).toBeVisible();
      // teacher.email (if not null)
      await expect(visibleText(page, DEV_SEED.teacher.email)).toBeVisible();
    });
  });

  test("course.consume-section-identity", {
    tag: "@Course/Web",
  }, async ({ page, preferenceFlow, detailCatalog, isolatedWorker, run }) => {
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const { course, teacher, section } = detailCatalog;
      const sectionPath = `/catalog/sections/${section.jwId}`;
      const assignments = await db.sectionTeacher.findMany();
      expect(assignments).toEqual([
        expect.objectContaining({
          sectionId: section.id,
          teacherId: teacher.id,
        }),
      ]);
      await preferenceFlow.run(async () => {
        await test.step("Course to section", async () => {
          await gotoAndWaitForReady(page, `/catalog/courses/${course.jwId}`);
          await gotoAndWaitForReady(
            page,
            `/catalog/courses/${course.jwId}#sections`,
          );
          await expect(page.locator("#sections")).toBeVisible();

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
          const sectionLink = page
            .locator(
              `a[href="/catalog/sections/${DEV_SEED.section.jwId}"]:visible`,
            )
            .or(page.locator("tbody a[href^='/catalog/sections/']:visible"))
            .first();
          await expect(sectionLink).toBeVisible();
          const expectSectionDetailReady = observeSectionDetailNavigation(
            page,
            preferenceFlow,
            DEV_SEED.section.jwId,
          );
          await sectionLink.click();
          await expect(page).toHaveURL(/\/catalog\/sections\/\d+/);
          await expectSectionDetailReady();
          expect(new URL(page.url()).pathname).toBe(sectionPath);
        });
      });
      await expectDetailCatalogUnchanged(db, detailCatalog, assignments);
    });
  });

  test("teacher.consume-section-identity", {
    tag: "@Teacher/Web",
  }, async ({ page, preferenceFlow, detailCatalog, isolatedWorker, run }) => {
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const { teacher, section } = detailCatalog;
      const sectionPath = `/catalog/sections/${section.jwId}`;
      const assignments = await db.sectionTeacher.findMany();
      expect(assignments).toEqual([
        expect.objectContaining({
          sectionId: section.id,
          teacherId: teacher.id,
        }),
      ]);
      await preferenceFlow.run(async () => {
        await test.step("Teacher to section", async () => {
          await navigateToSeedTeacher(page);
          await jumpToTeacherSection(
            page,
            /授课班级|Teaching Sections/i,
            "#sections",
          );

          const locale = await page.locator("html").getAttribute("lang");
          await expect(
            visibleText(
              page,
              locale === "en-us" ? "Spring 2026" : DEV_SEED.semesterNameCn,
            ),
          ).toBeVisible();
          // section.course.namePrimary (locale-dependent)
          await expect(
            page
              .getByText(DEV_SEED.course.nameCn)
              .or(page.getByText(DEV_SEED.course.nameEn))
              .filter({ visible: true })
              .first(),
          ).toBeVisible();
          // section.code (plain monospace text)
          await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
          // section.credits
          await expect(
            visibleText(page, String(DEV_SEED.section.credits)),
          ).toBeVisible();
          const sectionLink = page
            .locator("tbody a[href^='/catalog/sections/']:visible")
            .first();
          await expect(sectionLink).toBeVisible();
          const expectSectionDetailReady = observeSectionDetailNavigation(
            page,
            preferenceFlow,
            DEV_SEED.section.jwId,
          );
          await sectionLink.click();
          await expect(page).toHaveURL(/\/catalog\/sections\/\d+/);
          await expectSectionDetailReady();
          expect(new URL(page.url()).pathname).toBe(sectionPath);
        });
      });
      await expectDetailCatalogUnchanged(db, detailCatalog, assignments);
    });
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test("详情流式布局包含主要锚点区块", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
  }) => {
    await preferenceFlow.run(async () => {
      await navigateToSeedTeacher(page);

      await expect(page.locator("#introduction")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /授课班级|Teaching Sections/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /评论|Comments/i }),
      ).toBeVisible();

      await gotoAndWaitForReady(page, `${page.url().split("#")[0]}#comments`);
      await expect(page).toHaveURL(/\/catalog\/teachers\/\d+#comments$/);
      await expect(page.locator("#comments")).toBeVisible();
    });
  });

  test("移动端教师标题与流式区块保持紧凑", { tag: "@Teacher/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog: _detailCatalog,
  }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await navigateToSeedTeacher(page);

      const heading = page.getByRole("heading", { level: 1 }).first();
      await expect(heading).toHaveCSS("font-size", "24px");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);

      await gotoAndWaitForReady(page, `${page.url().split("#")[0]}#comments`);
      await expect(page.locator("#comments")).toBeVisible();
    });
  });

  // ── Description ─────────────────────────────────────────────────────────────

  communityTest(
    "已登录用户可编辑简介（content、lastEditedBy、lastEditedAt）",
    { tag: "@Description/Web" },
    async ({ page, account, community, communityFlow }) => {
      await communityFlow.run(
        async () => {
          const description = await arrangeDescription(
            community.db,
            "teacher",
            community.teacher.id,
            account.id,
          );
          await gotoAndWaitForReady(
            page,
            `/catalog/teachers/${community.teacher.id}#introduction`,
          );
          const introduction = page.locator("#introduction");
          await expect(introduction).toBeVisible();

          const content = `e2e-teacher-desc-${Date.now()}`;
          const editor = introduction.locator(
            '[data-slot="markdown-editor"] textarea',
          );
          const editButton = introduction.getByTestId("description-edit");
          await expect(editButton).toBeVisible({ timeout: 60_000 });
          await editButton.scrollIntoViewIfNeeded();
          await editButton.click();
          await expect(editor).toBeVisible();
          await editor.fill(content);

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
          await waitForUiSettled(page);

          // description.content rendered in the description tabpanel
          await expect(
            introduction
              .getByRole("tabpanel", { name: /简介|Description/i })
              .getByText(content),
          ).toBeVisible();
          // description.lastEditedBy.name
          await expect(
            page.getByText(account.name, { exact: false }).first(),
          ).toBeVisible();
          // description.lastEditedAt — some date/time text present near description
          await expect(introduction.getByText(/\d{4}/).first()).toBeVisible();
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

  // ── Comment creation on the teacher target ───────────────────────────────────

  communityTest(
    "已登录用户发布的评论绑定到教师目标",
    { tag: "@Comment/Web" },
    async ({ page, account, community, communityFlow }) => {
      await communityFlow.run(
        async () => {
          await gotoAndWaitForReady(
            page,
            `/catalog/teachers/${community.teacher.id}#comments`,
          );
          await expect(page).toHaveURL(/\/catalog\/teachers\/\d+#comments$/);
          const composer = await openCommentComposer(page);
          const anonymousCheckbox = page
            .locator("#comments")
            .getByRole("checkbox", {
              name: /匿名|Anonymous/i,
            });
          await expect(anonymousCheckbox).not.toBeChecked();

          const body = `e2e-teacher-comment-${Date.now()}`;
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
            teacherId: community.teacher.id,
            body,
            isAnonymous: false,
            status: "active",
          });
          await waitForUiSettled(page);

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
          // comment.body
          await expect(commentCard.getByText(body).first()).toBeVisible();
          // comment.createdAt (timestamp text)
          await expect(
            commentCard.getByText(/ago|\d{4}|\d+\s*(分钟|小时|天)/i).first(),
          ).toBeVisible();
          // The shared action menu offers no report entry. Edit and delete are
          // target-independent and belong to the section comment suite.
          await commentCard.hover();
          await commentCard
            .getByRole("button", { name: /更多操作|More actions/i })
            .first()
            .click();
          await expect(page.getByRole("menu")).toBeVisible();
          await expect(
            page.getByRole("menuitem", { name: /举报|Report/i }),
          ).toHaveCount(0);
          await page.keyboard.press("Escape");
        },
        { auditActions: { comment_create: 1 } },
      );
    },
  );
});

test("页面契约", { tag: "@Teacher/Web" }, async ({
  page,
  preferenceFlow,
  detailCatalog: _detailCatalog,
}) => {
  await preferenceFlow.run(async () => {
    await assertPageContract(page, {
      routePath: "/catalog/teachers/[id]/[section]",
    });
  });
});
