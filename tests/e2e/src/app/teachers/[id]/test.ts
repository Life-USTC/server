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
    .locator("tbody a[href^='/teachers/']:visible")
    .first();
  await expect(detailLink).toBeVisible();
  await detailLink.click();
  await expect(page).toHaveURL(/\/teachers\/\d+/);
  await waitForUiSettled(page);
}

test.describe("/teachers/[id]", () => {
  test.describe.configure({ mode: "serial" });

  test("contract", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/teachers/[id]", testInfo });
  });

  test("404 for invalid param", async ({ page }, testInfo) => {
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

  test("displays teacher primary name in the heading", async ({
    page,
  }, testInfo) => {
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

  test("does not display internal teacher id in ordinary UI", async ({
    page,
  }) => {
    await navigateToSeedTeacher(page);
    const teacherId = new URL(page.url()).pathname.split("/").pop();
    expect(teacherId).toBeTruthy();
    await expect(page.getByText(/教师 ID|Teacher ID/i)).toHaveCount(0);
    const content = await page.locator("#main-content").innerText();
    expect(content).not.toMatch(new RegExp(`\\b${teacherId}\\b`));
  });

  test("displays department, title, and email in basic info", async ({
    page,
  }, testInfo) => {
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

  test("sections table shows semester, course name, code, credits", async ({
    page,
  }, testInfo) => {
    await navigateToSeedTeacher(page);

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

  test("section links navigate to section detail", async ({
    page,
  }, testInfo) => {
    await navigateToSeedTeacher(page);

    const sectionLink = page
      .locator("tbody a[href^='/sections/']:visible")
      .first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();
    await expect(page).toHaveURL(/\/sections\/\d+/);
    await captureStepScreenshot(page, testInfo, "teacher/section-link");
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test("breadcrumb navigates back to teacher list", async ({
    page,
  }, testInfo) => {
    await navigateToSeedTeacher(page);

    const breadcrumb = page
      .getByRole("navigation", { name: "breadcrumb" })
      .getByRole("link", { name: /^(教师|Teachers)$/i })
      .first();
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.click();
    await expect(page).toHaveURL(/\/teachers(?:\?.*)?$/);
    await captureStepScreenshot(page, testInfo, "teacher/breadcrumb-back");
  });

  // ── Description ─────────────────────────────────────────────────────────────

  test("signed-in user can edit description (description.content, lastEditedBy, lastEditedAt)", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/teachers");
    await navigateToSeedTeacher(page);

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
    await expect(page.getByText(content).first()).toBeVisible();
    // description.lastEditedBy.name
    await expect(
      page.getByText(DEV_SEED.debugName, { exact: false }).first(),
    ).toBeVisible();
    // description.lastEditedAt — some date/time text present near description
    await expect(descCard.getByText(/\d{4}/).first()).toBeVisible();

    await captureStepScreenshot(page, testInfo, "teacher/description-updated");
  });

  // ── Comment CRUD ─────────────────────────────────────────────────────────────

  test("signed-in user can post, edit, and delete comment", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/teachers");
    await navigateToSeedTeacher(page);

    await expect(async () => {
      if (!page.url().includes("/teachers/")) {
        await navigateToSeedTeacher(page);
      }
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

    const anonymousCheckbox = page.getByRole("checkbox", {
      name: /匿名|Anonymous/i,
    });
    if (await anonymousCheckbox.isChecked()) {
      await anonymousCheckbox.click();
    }
    await expect(anonymousCheckbox).not.toBeChecked();

    const body = `e2e-teacher-comment-${Date.now()}`;
    const composer = page.locator("textarea").first();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.fill(body);
    const createResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/comments") &&
        r.request().method() === "POST" &&
        r.status() === 200,
    );
    await page.getByRole("button", { name: /发布评论|Post comment/i }).click();
    await createResponse;
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
    await expect(editCard.locator("textarea").first()).toBeVisible();
    await editCard.locator("textarea").first().fill(editedBody);
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
  });
});
