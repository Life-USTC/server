/**
 * E2E tests for `/courses/[jwId]` — Individual Course Detail page.
 *
 * ## Data Represented (course.yml → course-detail.display.fields)
 * - course.namePrimary (h1 title)
 * - course.nameSecondary (locale-dependent subtitle)
 * - course.code (monospace badge)
 * - course.educationLevel.namePrimary
 * - course.category.namePrimary
 * - course.classType.namePrimary
 * - section.semester.nameCn (semester column)
 * - section.code (section code badge)
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
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

const COURSE_URL = `/courses/${DEV_SEED.course.jwId}`;

test.describe("/courses/[jwId]", () => {
  test("contract", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/courses/[jwId]", testInfo });
  });

  test("404 for invalid param", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/courses/999999999", {
      expectMainContent: false,
    });
    await expect(page.getByText("404").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "course/404");
  });

  // ── Display fields ──────────────────────────────────────────────────────────

  test("displays course name (primary and secondary), code, and basic info", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);

    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toContainText(
      new RegExp(`${DEV_SEED.course.nameCn}|${DEV_SEED.course.nameEn}`),
    );

    const headingText = (await heading.textContent())?.trim();
    const expectedSubtitle =
      headingText === DEV_SEED.course.nameEn
        ? DEV_SEED.course.nameCn
        : DEV_SEED.course.nameEn;
    await expect(
      heading.locator("xpath=following-sibling::*[1]"),
    ).toContainText(expectedSubtitle);
    // course.code (monospace badge)
    await expect(visibleText(page, DEV_SEED.course.code)).toBeVisible();

    await captureStepScreenshot(page, testInfo, "course/heading-and-code");
  });

  test("displays education level, category, and class type in basic info", async ({
    page,
  }, testInfo) => {
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

  test("sections table shows semester, section code, teacher, campus, capacity", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);

    // section.semester.nameCn
    await expect(visibleText(page, DEV_SEED.semesterNameCn)).toBeVisible();
    // section.code badge
    await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
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

  test("jwId is NOT displayed in visible course UI (jwid-url-only rule)", async ({
    page,
  }) => {
    await gotoAndWaitForReady(page, COURSE_URL);
    const content = await page.locator("#main-content").innerText();
    // Raw jwId should not appear as visible text
    expect(content).not.toMatch(new RegExp(`\\b${DEV_SEED.course.jwId}\\b`));
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test("tab switching works", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);

    const nextTab = page.locator('[role="tab"][aria-selected="false"]').first();
    if ((await nextTab.count()) > 0) {
      const nextTabLabel = ((await nextTab.textContent()) ?? "").trim();
      expect(nextTabLabel).toBeTruthy();
      await expect(async () => {
        const targetTab = page.getByRole("tab", { name: nextTabLabel }).first();
        await targetTab.click();
        await expect(targetTab).toHaveAttribute("aria-selected", "true");
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });
      await captureStepScreenshot(page, testInfo, "course/tab-switch");
    }
  });

  test("breadcrumb navigates back to course list", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);
    const breadcrumb = page.locator('a[href="/courses"]').first();
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.click();
    await expect(page).toHaveURL(/\/courses(?:\?.*)?$/);
    await captureStepScreenshot(page, testInfo, "course/breadcrumb-back");
  });

  test("section row links to section detail", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);
    const sectionLink = page
      .locator(`a[href="/sections/${DEV_SEED.section.jwId}"]:visible`)
      .or(page.locator("tbody a[href^='/sections/']:visible"))
      .first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();
    await expect(page).toHaveURL(/\/sections\/\d+/);
    await captureStepScreenshot(page, testInfo, "course/section-link");
  });

  // ── Description ─────────────────────────────────────────────────────────────

  test("signed-in user can edit description (description.content)", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, COURSE_URL);

    const descCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText(/简介|Description/i) })
      .first();
    await expect(descCard).toBeVisible();

    const content = `e2e-course-desc-${Date.now()}`;
    const editor = descCard.locator("textarea").first();
    await expect(async () => {
      await descCard.getByRole("button", { name: /^编辑$|^Edit$/i }).click();
      await expect(editor).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });
    await editor.fill(content);

    const saveResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/descriptions") &&
        r.request().method() === "POST" &&
        r.status() === 200,
    );
    await descCard.getByRole("button", { name: /保存|Save/i }).click();
    await saveResponse;
    await expect(page.getByText(content).first()).toBeVisible();
    await captureStepScreenshot(page, testInfo, "course/description-updated");
  });

  // ── Comment CRUD ─────────────────────────────────────────────────────────────

  test("signed-in user can post, edit, and delete comment", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, COURSE_URL);

    const commentsTab = page
      .getByRole("tab", { name: /评论|Comments/i })
      .first();
    await expect(commentsTab).toBeVisible();
    await commentsTab.click();
    await expect(commentsTab).toHaveAttribute("aria-selected", "true");

    const body = `e2e-course-comment-${Date.now()}`;
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

    const commentCard = page
      .locator('[id^="comment-"]')
      .filter({ hasText: body })
      .first();
    await expect(commentCard).toBeVisible();
    // comment.author.name visible
    await expect(
      commentCard.getByText(DEV_SEED.debugName).first(),
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
        r.url().includes("/api/comments/") &&
        r.request().method() === "PATCH" &&
        r.status() === 200,
    );
    await editCard.getByRole("button", { name: /保存|Save/i }).click();
    await editResponse;
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
    await captureStepScreenshot(page, testInfo, "course/comment-deleted");
  });
});
