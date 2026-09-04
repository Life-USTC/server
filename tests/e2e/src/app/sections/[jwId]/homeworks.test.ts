/**
 * E2E: /catalog/sections/[jwId] — Section homework CRUD and homework comment permalinks
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { cleanupCommentsForE2e } from "../../../../utils/comments";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { cleanupHomeworksForE2e } from "../../../../utils/homeworks";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import {
  escapeForRegExp,
  jumpToSection,
  SECTION_URL,
  selectHomeworkAction,
} from "./_helpers";

test.describe("/catalog/sections/[jwId] 班级详情页", () => {
  test("移动端新建与编辑作业显示同一份中文填写规范", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDebugUser(page, SECTION_URL);
    const localeResponse = await page.request.post("/api/account/preferences", {
      data: { locale: "zh-cn" },
    });
    expect(localeResponse.status()).toBe(200);
    await gotoAndWaitForReady(page, SECTION_URL);
    await jumpToSection(page, /作业|Homework/i, "#homework");

    await page
      .getByRole("button", { name: /新建|创建作业|Create/i })
      .first()
      .click();
    const createDialog = page.locator('[data-slot="dialog-content"]').first();
    const advancedSettings = createDialog.getByRole("button", {
      name: /其他可选设置|Other optional settings|收起其他可选设置|Hide optional settings/i,
    });
    await expect(advancedSettings).toHaveAttribute("aria-expanded", "false");
    await expect(
      createDialog.getByRole("textbox", { name: /发布日期|Published/i }),
    ).toHaveCount(0);
    await advancedSettings.click();
    await expect(
      createDialog.getByRole("textbox", { name: /发布日期|Published/i }),
    ).toBeVisible();
    await advancedSettings.click();
    await expect(
      createDialog.getByRole("textbox", { name: /发布日期|Published/i }),
    ).toHaveCount(0);
    const createTrigger = createDialog.getByTestId(
      "section-create-homework-style-guide-trigger",
    );
    await expect(createTrigger).toHaveAttribute("aria-expanded", "true");
    const createGuide = createDialog.getByTestId(
      "section-create-homework-style-guide-content",
    );
    await expect(createGuide).toBeVisible();
    await expect(createGuide).toContainText("第{N}次作业");
    await expect(createGuide).toContainText("{主题}作业");
    await expect(createGuide).toContainText(
      "避免使用“第一章作业”等仅按章节命名的标题",
    );
    await expect(createGuide).toContainText(
      "不要在标题中包含课程名称或课程代码",
    );
    await expect(createGuide.locator("pre")).toContainText(
      "- 题目：...\n- 提交方式：...\n- 提交地址：...\n- 备注：...",
    );
    await expect(createGuide).toContainText("不会阻止保存");
    await expect(
      createDialog.getByRole("button", { name: /创建作业|Create homework/i }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await captureStepScreenshot(
      page,
      testInfo,
      "section/homework-style-guide-create-mobile",
    );

    await page.keyboard.press("Escape");
    await expect(createDialog).toHaveCount(0);

    const homeworkCard = page
      .getByRole("button", {
        name: new RegExp(escapeForRegExp(DEV_SEED.homeworks.title)),
      })
      .first();
    await homeworkCard.click();
    const detailDialog = page.locator('[data-slot="dialog-content"]').first();
    await selectHomeworkAction(page, detailDialog, /编辑信息|Edit details/i);
    const editTrigger = detailDialog.getByTestId(
      "section-edit-homework-style-guide-trigger",
    );
    await expect(editTrigger).toHaveAttribute("aria-expanded", "true");
    const editGuide = detailDialog.getByTestId(
      "section-edit-homework-style-guide-content",
    );
    await expect(editGuide).toBeVisible();
    await expect(editGuide).toContainText("第{N}次作业");
    await expect(editGuide.locator("pre")).toContainText("- 题目：...");
    await captureStepScreenshot(
      page,
      testInfo,
      "section/homework-style-guide-edit-mobile",
    );

    const saveButton = detailDialog.getByRole("button", {
      name: /保存修改|Save changes/i,
    });
    await saveButton.scrollIntoViewIfNeeded();
    await expect(saveButton).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("移动端班级作业长标题和说明保持对话框可用", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 320, height: 568 });
    await signInAsDebugUser(page, SECTION_URL);

    const titlePrefix = `e2e-section-hw-mobile-${Date.now()}`;
    const title = `${titlePrefix}-${"长标题".repeat(32)}`;
    const description = `${"这是用于验证班级作业详情滚动区域的长说明。 ".repeat(24)}\n\nsection-mobile-content-marker`;
    let homeworkId: string | undefined;

    try {
      const createResponse = await page.request.post(
        "/api/community/section-homeworks",
        {
          data: {
            sectionJwId: DEV_SEED.section.jwId,
            submissionDueAt: null,
            title,
            description,
          },
        },
      );
      expect(createResponse.status()).toBe(201);
      const body = (await createResponse.json()) as {
        homework?: { id?: string };
        id?: string;
      };
      homeworkId = body.homework?.id ?? body.id;
      expect(homeworkId).toBeTruthy();

      await gotoAndWaitForReady(page, SECTION_URL);
      await jumpToSection(page, /作业|Homework/i, "#homework");
      const homeworkCard = page
        .getByRole("button", { name: new RegExp(escapeForRegExp(title)) })
        .first();
      await expect(homeworkCard).toBeVisible();
      await homeworkCard.click();

      const detailDialog = page.locator('[data-slot="dialog-content"]').first();
      await expect(detailDialog).toBeVisible();
      await expect(
        detailDialog.locator('[data-slot="dialog-title"]'),
      ).toHaveText(title);
      await expect(
        detailDialog.getByText("section-mobile-content-marker"),
      ).toBeVisible();

      const viewportHeight = page.viewportSize()?.height ?? 568;
      const dialogBox = await detailDialog.boundingBox();
      const footer = detailDialog.locator('[data-slot="dialog-footer"]');
      const footerBox = await footer.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect(footerBox).not.toBeNull();
      if (!dialogBox || !footerBox)
        throw new Error("Expected the mobile section homework dialog bounds");
      expect(dialogBox.y).toBeGreaterThanOrEqual(0);
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(
        viewportHeight,
      );
      expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
        viewportHeight,
      );
      await expect(footer).toBeInViewport();

      const completion = footer.getByRole("button", {
        name: /标记为完成|Mark as complete/i,
      });
      const moreActions = footer.getByRole("button", {
        name: /更多信息|More details/i,
      });
      await expect(completion).toBeVisible();
      await expect(moreActions).toBeVisible();
      const [completionBox, moreActionsBox] = await Promise.all([
        completion.boundingBox(),
        moreActions.boundingBox(),
      ]);
      expect(completionBox).not.toBeNull();
      expect(moreActionsBox).not.toBeNull();
      expect(completionBox?.width ?? 0).toBeGreaterThanOrEqual(200);
      expect(moreActionsBox?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      await selectHomeworkAction(page, detailDialog, /编辑信息|Edit details/i);
      const editForm = detailDialog.locator("form").first();
      await expect(editForm).toBeVisible();
      await editForm.getByRole("button", { name: /取消|Cancel/i }).click();
      await expect(editForm).toHaveCount(0);

      await page.keyboard.press("Escape");
      await expect(detailDialog).toHaveCount(0);
    } finally {
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });

  test("班级作业区块默认以列表展示", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    await jumpToSection(page, /作业|Homework/i, "#homework");

    await expect(page.getByTestId("section-homeworks-list")).toBeVisible();
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoAndWaitForReady(page, `${SECTION_URL}#homework`);
    await expect(page.getByTestId("section-homeworks-items")).toBeVisible();
    await expect(
      page.getByTestId("section-homeworks-list").locator("table"),
    ).toBeHidden();
    const homeworkItem = page
      .getByTestId("section-homeworks-items")
      .locator('[data-slot="item"]')
      .first();
    await expect(homeworkItem).toBeVisible();
    const detailButton = homeworkItem.getByRole("button").first();
    const detailBox = await detailButton.boundingBox();
    expect(detailBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(detailBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await captureStepScreenshot(page, testInfo, "section/homework-list-view");
  });

  test("已登录用户可创建作业、查看讨论、切换完成状态并删除", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, SECTION_URL);
    let homeworkId: string | undefined;

    try {
      await jumpToSection(page, /作业|Homework/i, "#homework");

      // Create
      const showCreate = page
        .getByRole("button", { name: /新建|创建作业|Create/i })
        .first();
      if ((await showCreate.count()) > 0) {
        await showCreate.click();
      }
      const createDialog = page.locator('[data-slot="dialog-content"]').first();
      await expect(createDialog).toBeVisible({ timeout: 5_000 });

      const title = `e2e-section-hw-${Date.now()}`;
      await createDialog.getByTestId("section-homework-title").fill(title);
      const createResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/section-homeworks") &&
          r.request().method() === "POST" &&
          r.status() === 201,
      );
      await createDialog
        .getByRole("button", { name: /创建作业|Create homework/i })
        .click();
      const createdHomeworkResponse = await createResponse;
      const createResponseBody = (await createdHomeworkResponse.json()) as {
        id?: string;
      };
      expect(createResponseBody.id).toBeTruthy();
      homeworkId = createResponseBody.id;
      await waitForUiSettled(page);

      const hwCard = page
        .getByRole("button", { name: new RegExp(escapeForRegExp(title)) })
        .first();
      await expect(hwCard).toBeVisible();

      // homework.title is displayed
      await expect(hwCard.getByText(title)).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/homework-created");
      await hwCard.click();
      const homeworkPopout = page
        .locator('[data-slot="dialog-content"]')
        .first();
      await expect(homeworkPopout).toBeVisible();

      // Homework discussion is embedded in the detail dialog.
      await expect(
        homeworkPopout.getByText(/评论|Comments/i).first(),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/homework-discuss");

      // Toggle completion (section-homework-tab.display.fields: user completion status)
      const completionButton = homeworkPopout
        .getByRole("button", {
          name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
        })
        .first();
      await expect(completionButton).toBeVisible();
      const toggleResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/workspace/homeworks/") &&
          r.url().includes("/completion") &&
          r.request().method() === "PUT" &&
          r.status() === 200,
      );
      await completionButton.click();
      await toggleResponse;
      await captureStepScreenshot(
        page,
        testInfo,
        "section/homework-completion-toggled",
      );

      // Delete
      await selectHomeworkAction(page, homeworkPopout, /删除|Delete/i);
      const deleteDialog = page
        .locator('[data-slot="alert-dialog-content"]')
        .last();
      await expect(deleteDialog).toBeVisible();
      const deleteResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/community/section-homeworks/") &&
          r.request().method() === "DELETE" &&
          r.status() === 200,
      );
      await deleteDialog.getByRole("button", { name: /删除|Delete/i }).click();
      await deleteResponse;
      await expect(hwCard).toHaveCount(0);
    } finally {
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });

  test("可编辑班级作业的截止日期、说明、重要和组队标记", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, SECTION_URL);
    let homeworkId: string | undefined;

    try {
      const title = `e2e-section-hw-edit-${Date.now()}`;
      const createResponse = await page.request.post(
        "/api/community/section-homeworks",
        {
          data: {
            sectionJwId: DEV_SEED.section.jwId,
            submissionDueAt: null,
            title,
          },
        },
      );
      expect(createResponse.status()).toBe(201);
      const createBody = (await createResponse.json()) as {
        homework?: { id?: string };
        id?: string;
      };
      homeworkId = createBody.homework?.id ?? createBody.id;
      expect(homeworkId).toBeTruthy();

      await gotoAndWaitForReady(page, SECTION_URL);
      await jumpToSection(page, /作业|Homework/i, "#homework");

      const hwCard = page
        .getByRole("button", { name: new RegExp(escapeForRegExp(title)) })
        .first();
      await expect(hwCard).toBeVisible();
      await hwCard.click();

      const detailDialog = page.locator('[data-slot="dialog-content"]').first();
      await expect(detailDialog).toBeVisible();
      await selectHomeworkAction(page, detailDialog, /Edit details|编辑信息/i);

      const description = `e2e-section-hw-edited-description-${Date.now()}`;
      const dueAt = "2026-12-31T23:59";
      const editForm = detailDialog.locator("form").first();
      await editForm
        .getByRole("textbox", { name: /Details|说明/i })
        .fill(description);
      await editForm
        .getByRole("textbox", { name: /Submission due|提交截止/i })
        .fill(dueAt);
      const advancedSettings = editForm.getByRole("button", {
        name: /其他可选设置|Other optional settings|收起其他可选设置|Hide optional settings/i,
      });
      await expect(advancedSettings).toHaveAttribute("aria-expanded", "false");
      await advancedSettings.click();
      await editForm
        .getByRole("checkbox", { name: /Major assignment|大作业/i })
        .click();
      await editForm
        .getByRole("checkbox", { name: /Team required|需要组队/i })
        .click();

      await editForm
        .getByRole("button", { name: /Save changes|保存修改/i })
        .click();
      await expect(
        editForm.getByRole("button", { name: /Save changes|保存修改/i }),
      ).toHaveCount(0, { timeout: 15_000 });

      await expect(detailDialog.getByText(description)).toBeVisible();
      const secondaryDetails = detailDialog.getByTestId(
        "homework-secondary-details",
      );
      const secondaryDetailsTrigger = secondaryDetails.getByRole("button", {
        name: /More details|更多信息/i,
      });
      await expect(secondaryDetailsTrigger).toContainText(
        /Major assignment|大作业/i,
      );
      await expect(secondaryDetailsTrigger).toContainText(
        /Team required|需要组队/i,
      );

      const deadlineSummary = detailDialog.getByTestId(
        "homework-deadline-summary",
      );
      await expect(deadlineSummary).toContainText(
        /2026-12-31|2026\/12\/31|12\/31\/26|12月31日|Dec 31/,
      );
      await expect(deadlineSummary).toContainText(/23:59|11:59 PM/);
      await captureStepScreenshot(
        page,
        testInfo,
        "section/homework-edited-full-fields",
      );
    } finally {
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });

  test("作业评论永久链接打开目标评论", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, SECTION_URL);
    let homeworkId: string | undefined;
    let commentId: string | undefined;

    try {
      const title = `e2e-homework-permalink-${Date.now()}`;
      const homeworkResponse = await page.request.post(
        "/api/community/section-homeworks",
        {
          data: {
            sectionJwId: DEV_SEED.section.jwId,
            title,
          },
        },
      );
      expect(homeworkResponse.status()).toBe(201);
      const homeworkBody = (await homeworkResponse.json()) as {
        homework?: { id?: string };
        id?: string;
      };
      homeworkId = homeworkBody.homework?.id ?? homeworkBody.id;
      expect(homeworkId).toBeTruthy();

      const body = `e2e-homework-comment-permalink-${Date.now()}`;
      const commentResponse = await page.request.post(
        "/api/community/comments",
        {
          data: {
            body,
            homeworkId,
            targetType: "homework",
          },
        },
      );
      expect(commentResponse.status()).toBe(201);
      const commentBody = (await commentResponse.json()) as { id?: string };
      commentId = commentBody.id;
      expect(commentId).toBeTruthy();

      await gotoAndWaitForReady(page, `/community/comments/${commentId}`);
      await expect(page).toHaveURL(
        new RegExp(
          `/catalog/sections/${DEV_SEED.section.jwId}\\?homeworkId=${escapeForRegExp(homeworkId ?? "")}#comment-${escapeForRegExp(commentId ?? "")}$`,
        ),
      );

      const homeworkDialog = page
        .locator('[data-slot="dialog-content"]')
        .filter({ hasText: title })
        .first();
      await expect(homeworkDialog).toBeVisible();
      const targetComment = homeworkDialog.locator(
        `[id="comment-${commentId}"]`,
      );
      await expect(targetComment).toBeVisible();
      await expect(targetComment.getByText(body)).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "section/homework-comment-permalink",
      );
    } finally {
      await cleanupCommentsForE2e([commentId]);
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });
});
