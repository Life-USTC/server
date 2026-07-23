/**
 * E2E tests for `/catalog/courses/[jwId]` — Individual Course Detail page.
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
import scenarioData from "../../../../fixtures/scenario.json" with {
  type: "json",
};
import { signInAsDebugUser } from "../../../../utils/auth";
import { cleanupCommentsForE2e } from "../../../../utils/comments";
import {
  restoreDescriptionTargetSnapshot,
  snapshotDescriptionTargetForE2e,
  waitForDescriptionAuditRows,
} from "../../../../utils/description-state";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

const COURSE_URL = `/catalog/courses/${DEV_SEED.course.jwId}`;
const COURSE_WITH_DESCRIPTION_URL = `/catalog/courses/${scenarioData.courses[2].jwId}/introduction`;
const COURSE_WITH_DESCRIPTION_TEXT = "实验课建议准备护目镜并提前完成预习问答。";

async function jumpToCourseSection(
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

test.describe("/catalog/courses/[jwId] 课程详情", () => {
  test.describe.configure({ mode: "serial" });

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

  test("旧 jwId 永久重定向到 canonical 课程 URL", async ({ page }) => {
    await gotoAndWaitForReady(
      page,
      `/catalog/courses/${DEV_SEED.course.legacyJwId}/sections?from=legacy`,
    );
    await expect(page).toHaveURL(
      `/catalog/courses/${DEV_SEED.course.jwId}/sections?from=legacy`,
    );
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(
      new RegExp(`${DEV_SEED.course.nameCn}|${DEV_SEED.course.nameEn}`),
    );
  });

  // ── Display fields ──────────────────────────────────────────────────────────

  test("显示课程名称、代码和基本信息", async ({ page }, testInfo) => {
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
    await jumpToCourseSection(page, /班级|Sections/i, "#course-sections");

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

  test("jwId 不在课程可见界面中显示", async ({ page }) => {
    await gotoAndWaitForReady(page, COURSE_URL);
    const content = await page.locator("#main-content").innerText();
    // Raw jwId should not appear as visible text
    expect(content).not.toMatch(new RegExp(`\\b${DEV_SEED.course.jwId}\\b`));
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test("详情导航可跳转到主要区块", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);

    const nav = page.getByTestId("detail-section-nav");
    await expect(nav).toBeVisible();
    await expect(
      nav.getByRole("link", { name: /简介|Description/i }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: /班级|Sections/i }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: /评论|Comments/i }),
    ).toBeVisible();

    await jumpToCourseSection(page, /评论|Comments/i, "#course-comments");
    await expect(page).toHaveURL(/\/catalog\/courses\/\d+\/comments$/);
    await captureStepScreenshot(page, testInfo, "course/detail-nav");
  });

  test("移动端标题层级紧凑且详情导航横向可用", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, COURSE_URL);

    const heading = page.getByRole("heading", { level: 1 }).first();
    const code = visibleText(page, DEV_SEED.course.code);
    await expect(heading).toHaveCSS("font-size", "24px");
    await expect(code).toBeVisible();
    expect((await code.boundingBox())?.y).toBeLessThan(
      (await heading.boundingBox())?.y ?? 0,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);

    const nav = page.getByTestId("detail-section-nav");
    await expect(nav).toBeVisible();
    await expect(nav.locator("[data-sidebar='menu']")).toHaveCSS(
      "flex-direction",
      "row",
    );
    await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
    await jumpToCourseSection(page, /评论|Comments/i, "#course-comments");

    await captureStepScreenshot(page, testInfo, "course/detail-mobile");
  });

  test("班级行链接到班级详情", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, COURSE_URL);
    await jumpToCourseSection(page, /班级|Sections/i, "#course-sections");
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

  test("登录用户可以编辑课程简介", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, `${COURSE_URL}/introduction`);
    const snapshot = await snapshotDescriptionTargetForE2e(
      page.request,
      { courseJwId: DEV_SEED.course.jwId, targetType: "course" },
      ["description_edit"],
    );

    try {
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
      await descCard.getByRole("tab", { name: /预览|Preview/i }).click();
      await expect(
        descCard
          .getByRole("tabpanel", { name: /预览|Preview/i })
          .getByText(content),
      ).toBeVisible();

      const saveResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/descriptions") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      await descCard.getByRole("button", { name: /保存|Save/i }).click();
      await saveResponse;
      await expect(
        descCard
          .getByRole("tabpanel", { name: /简介|Description/i })
          .getByText(content),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "course/description-updated");
    } finally {
      if (snapshot.original) {
        await waitForDescriptionAuditRows(snapshot.original, 1);
      }
      await restoreDescriptionTargetSnapshot(page.request, snapshot);
    }
  });

  // ── Comment CRUD ─────────────────────────────────────────────────────────────

  test("登录用户可以发布、编辑和删除评论", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, COURSE_URL);
    let commentId: string | undefined;

    try {
      await jumpToCourseSection(page, /评论|Comments/i, "#course-comments");
      await expect(page).toHaveURL(/\/catalog\/courses\/\d+\/comments$/);

      const body = `e2e-course-comment-${Date.now()}`;
      const composer = page.locator("#course-comments textarea").first();
      await expect(composer).toBeVisible({ timeout: 15_000 });
      await composer.fill(body);
      const createResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/comments") &&
          r.request().method() === "POST" &&
          r.status() === 201,
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
          r.url().includes("/api/community/comments/") &&
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
      await captureStepScreenshot(page, testInfo, "course/comment-deleted");
    } finally {
      await cleanupCommentsForE2e([commentId]);
    }
  });
});

test.describe("/catalog/courses/[jwId]/introduction 无 JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("SSR 保留 sanitized Markdown 简介", async ({ page }) => {
    await page.goto(COURSE_WITH_DESCRIPTION_URL);

    await expect(page.getByText(COURSE_WITH_DESCRIPTION_TEXT)).toBeVisible();
    await expect(
      page.locator("#course-description .markdown-preview"),
    ).toBeVisible();
  });
});
