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
 * - section.code (badge, monospace)
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
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { cleanupCommentsForE2e } from "../../../../utils/comments";
import {
  restoreDescriptionTargetSnapshot,
  snapshotDescriptionTargetForE2e,
  waitForDescriptionAuditRows,
} from "../../../../utils/description-state";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { visibleText } from "../../../../utils/locators";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

async function navigateToSeedTeacher(
  page: Parameters<typeof gotoAndWaitForReady>[0],
) {
  await gotoAndWaitForReady(
    page,
    `/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}`,
  );
  const detailLink = page
    .locator("#main-content a[href^='/teachers/']:visible")
    .first();
  await expect(detailLink).toBeVisible();
  await detailLink.click();
  await expect(page).toHaveURL(/\/teachers\/\d+/);
  await waitForUiSettled(page);
}

async function jumpToTeacherSection(
  page: Parameters<typeof gotoAndWaitForReady>[0],
  name: RegExp,
  selector: string,
) {
  const link = page
    .getByTestId("detail-section-nav")
    .getByRole("link", { name })
    .first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator(selector)).toBeVisible();
}

test.describe("/teachers/[id] 教师详情页", () => {
  test.describe.configure({ mode: "serial" });

  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/teachers/[id]", testInfo });
  });

  test("无效参数返回 404", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/teachers/999999999", {
      expectMainContent: false,
    });
    await expect(page.getByText("404").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "teacher/404");
  });

  // ── Display fields ──────────────────────────────────────────────────────────

  test("标题中显示教师主名称", async ({ page }, testInfo) => {
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

    await captureStepScreenshot(page, testInfo, "teacher/heading");
  });

  test("常规界面不显示内部教师 ID", async ({ page }) => {
    await navigateToSeedTeacher(page);
    const teacherId = new URL(page.url()).pathname.split("/").pop();
    expect(teacherId).toBeTruthy();
    await expect(page.getByText(/教师 ID|Teacher ID/i)).toHaveCount(0);
    await expect(page.locator("#main-content")).not.toContainText(
      new RegExp(`(?:教师 ID|Teacher ID)\\s*${teacherId}`),
    );
  });

  test("基本信息中显示院系、职称与邮箱", async ({ page }, testInfo) => {
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

    await captureStepScreenshot(page, testInfo, "teacher/basic-info");
  });

  test("班级表格显示学期、课程名、代码与学分", async ({ page }, testInfo) => {
    await navigateToSeedTeacher(page);
    await jumpToTeacherSection(
      page,
      /授课班级|Teaching Sections/i,
      "#teacher-sections",
    );

    // section.semester.nameCn badge
    await expect(visibleText(page, DEV_SEED.semesterNameCn)).toBeVisible();
    // section.course.namePrimary (locale-dependent)
    await expect(
      page
        .getByText(DEV_SEED.course.nameCn)
        .or(page.getByText(DEV_SEED.course.nameEn))
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    // section.code badge (monospace)
    await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
    // section.credits
    await expect(
      visibleText(page, String(DEV_SEED.section.credits)),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "teacher/sections-table");
  });

  test("班级链接导航到班级详情", async ({ page }, testInfo) => {
    await navigateToSeedTeacher(page);
    await jumpToTeacherSection(
      page,
      /授课班级|Teaching Sections/i,
      "#teacher-sections",
    );

    const sectionLink = page
      .locator("tbody a[href^='/sections/']:visible")
      .first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();
    await expect(page).toHaveURL(/\/sections\/\d+/);
    await captureStepScreenshot(page, testInfo, "teacher/section-link");
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test("详情导航可跳转到主要区块", async ({ page }, testInfo) => {
    await navigateToSeedTeacher(page);

    const nav = page.getByTestId("detail-section-nav");
    await expect(nav).toBeVisible();
    await expect(
      nav.getByRole("link", { name: /简介|Description/i }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: /授课班级|Teaching Sections/i }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: /评论|Comments/i }),
    ).toBeVisible();

    await jumpToTeacherSection(page, /评论|Comments/i, "#teacher-comments");
    await expect(page).toHaveURL(/\/teachers\/\d+\/comments$/);
    await captureStepScreenshot(page, testInfo, "teacher/detail-nav");
  });

  // ── Description ─────────────────────────────────────────────────────────────

  test("已登录用户可编辑简介（content、lastEditedBy、lastEditedAt）", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/teachers");
    await navigateToSeedTeacher(page);
    const teacherId = page.url().match(/\/teachers\/(\d+)/)?.[1];
    expect(teacherId).toBeTruthy();
    if (!teacherId) {
      throw new Error("Expected teacher id in URL");
    }
    const snapshot = await snapshotDescriptionTargetForE2e(
      page.request,
      { targetType: "teacher", teacherId },
      ["description_edit"],
    );

    try {
      await jumpToTeacherSection(
        page,
        /简介|Description/i,
        "#teacher-description",
      );
      const descCard = page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByText(/简介|Description/i) })
        .first();
      await expect(descCard).toBeVisible();

      await descCard.getByRole("button", { name: /^编辑$|^Edit$/i }).click();
      const content = `e2e-teacher-desc-${Date.now()}`;
      await descCard.locator("textarea").first().fill(content);

      const saveResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/descriptions") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      await descCard.getByRole("button", { name: /保存|Save/i }).click();
      await saveResponse;
      await waitForUiSettled(page);

      // description.content rendered
      await expect(
        descCard
          .getByRole("tabpanel", { name: /简介|Description/i })
          .getByText(content),
      ).toBeVisible();
      // description.lastEditedBy.name
      await expect(
        page.getByText(DEV_SEED.debugName, { exact: false }).first(),
      ).toBeVisible();
      // description.lastEditedAt — some date/time text present near description
      await expect(descCard.getByText(/\d{4}/).first()).toBeVisible();

      await captureStepScreenshot(
        page,
        testInfo,
        "teacher/description-updated",
      );
    } finally {
      if (snapshot.original) {
        await waitForDescriptionAuditRows(snapshot.original, 1);
      }
      await restoreDescriptionTargetSnapshot(page.request, snapshot);
    }
  });

  // ── Comment CRUD ─────────────────────────────────────────────────────────────

  test("已登录用户可发布、编辑与删除评论", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/teachers");
    await navigateToSeedTeacher(page);
    let commentId: string | undefined;

    try {
      await expect(async () => {
        if (!page.url().includes("/teachers/")) {
          await navigateToSeedTeacher(page);
        }
        await jumpToTeacherSection(page, /评论|Comments/i, "#teacher-comments");
        await expect(page).toHaveURL(/\/teachers\/\d+\/comments$/);
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });

      const anonymousCheckbox = page.getByRole("checkbox", {
        name: /匿名|Anonymous/i,
      });
      if (await anonymousCheckbox.isChecked()) {
        await anonymousCheckbox.click();
      }
      await expect(anonymousCheckbox).not.toBeChecked();

      const body = `e2e-teacher-comment-${Date.now()}`;
      const composer = page
        .locator("#teacher-comments")
        .getByRole("textbox", { name: /评论内容|Comment body/i })
        .first();
      await expect(composer).toBeVisible({ timeout: 15_000 });
      await composer.fill(body);
      const createResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/comments") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      await page
        .getByRole("button", { name: /发布评论|Post comment/i })
        .click();
      const createdCommentResponse = await createResponse;
      const createResponseBody = (await createdCommentResponse.json()) as {
        id?: string;
      };
      expect(createResponseBody.id).toBeTruthy();
      commentId = createResponseBody.id;
      await waitForUiSettled(page);

      const commentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: body })
        .first();
      await expect(commentCard).toBeVisible();
      // comment.body
      await expect(commentCard.getByText(body).first()).toBeVisible();
      // comment.createdAt (timestamp text)
      await expect(
        commentCard.getByText(/ago|\d{4}|\d+\s*(分钟|小时|天)/i).first(),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "teacher/comment-posted");

      // Edit
      await commentCard.hover();
      await commentCard.getByRole("button", { name: /编辑|Edit/i }).click();
      const editedBody = `${body}-edited`;
      const editCard = page
        .locator('[id^="comment-"]')
        .filter({ has: page.locator(".sr-only", { hasText: body }) })
        .first();
      const editTextarea = editCard
        .getByRole("textbox", {
          name: /编辑评论内容|Edit comment body/i,
        })
        .first();
      await expect(editTextarea).toBeVisible();
      await editTextarea.fill(editedBody);
      const editResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/comments/") &&
          r.request().method() === "PATCH" &&
          r.status() === 200,
      );
      await editCard.getByRole("button", { name: /保存|Save/i }).click();
      await editResponse;
      await waitForUiSettled(page);
      await expect(page.getByText(editedBody).first()).toBeVisible();
      const editedCommentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: editedBody })
        .first();
      await expect(editedCommentCard).toBeVisible();

      // Delete
      await editedCommentCard.hover();
      await editedCommentCard
        .getByRole("button", { name: /更多操作|More actions/i })
        .first()
        .click();
      await expect(
        page.getByRole("menuitem", { name: /举报|Report/i }),
      ).toHaveCount(0);
      const deleteResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/comments/") &&
          r.request().method() === "DELETE" &&
          r.status() === 200,
      );
      await page.getByRole("menuitem", { name: /删除|Delete/i }).click();
      const dialog = page.getByRole("dialog", {
        name: /删除评论|Delete Comment/i,
      });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /删除|Delete/i }).click();
      await deleteResponse;
      await captureStepScreenshot(page, testInfo, "teacher/comment-deleted");
    } finally {
      await cleanupCommentsForE2e([commentId]);
    }
  });
});
