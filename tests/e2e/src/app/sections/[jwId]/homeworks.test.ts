/**
 * E2E: /catalog/sections/[jwId] — Independent section homework operations and known-state consumers
 */

import { expect } from "@playwright/test";
import {
  closeDetailDialog,
  detailDialog,
  expectComfortablePopupWidth,
  expectDetailDialogFitsViewport,
  expectHomeworkDetailOrder,
  expectIconOnlyCloseButton,
  expectSingleColumnDiscussion,
} from "../../../../utils/detail-dialog";
import {
  readHomeworkCompletion,
  readHomeworks,
} from "../../../../utils/homework-state";
import { observeAction } from "../../../../utils/observed-action";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { test } from "../../../../utils/section-homework-fixture";
import {
  escapeForRegExp,
  jumpToSection,
  selectHomeworkAction,
} from "./_helpers";

test.describe("/catalog/sections/[jwId] 班级详情页", () => {
  test("homework.section-style-guide", async ({
    sectionRun,
    page,
    section,
    homeworks,
  }, testInfo) => {
    await sectionRun(async ({ headers }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const localeResponse = await page.request.post(
        "/api/account/preferences",
        { headers, data: { locale: "zh-cn" } },
      );
      expect(localeResponse.status()).toBe(200);
      await jumpToSection(page, section.path, /作业|Homework/i, "#homework");

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
      await createTrigger.click();
      await expect(createGuide).toBeHidden();
      await createTrigger.click();
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
          name: new RegExp(escapeForRegExp(homeworks[0].title)),
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
      await editTrigger.click();
      await expect(editGuide).toBeHidden();
      await editTrigger.click();
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
  });

  test("移动端班级作业长标题和说明保持对话框可用", async ({
    sectionRun,
    page,
    section,
    account,
    isolatedWorker,
  }) => {
    await sectionRun(async () => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 320, height: 568 });

      const titlePrefix = `e2e-section-hw-mobile-${Date.now()}`;
      const title = `${titlePrefix}-${"长标题".repeat(32)}`;
      const description = `${"这是用于验证班级作业详情滚动区域的长说明。 ".repeat(24)}\n\nsection-mobile-content-marker`;

      const db = isolatedWorker.database.owner;
      await db.homework.create({
        data: {
          sectionId: section.id,
          createdById: account.id,
          title,
          submissionDueAt: null,
          description: { create: { content: description } },
        },
      });
      const before = await readHomeworks(db, section.id);

      await jumpToSection(page, section.path, /作业|Homework/i, "#homework");
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
      expect(await readHomeworks(db, section.id)).toEqual(before);
    });
  });

  test("班级作业区块默认以列表展示", async ({
    sectionRun,
    page,
    section,
    homeworks: _homeworks,
  }, testInfo) => {
    await sectionRun(async () => {
      await page.context().clearCookies();
      await jumpToSection(page, section.path, /作业|Homework/i, "#homework");

      await expect(page.getByTestId("section-homeworks-list")).toBeVisible();
      await page.setViewportSize({ width: 320, height: 568 });
      await gotoAndWaitForReady(page, `${section.path}#homework`);
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
  });

  test("作业详情弹窗单栏展示截止日期、讨论与图标关闭按钮", async ({
    sectionRun,
    page,
    section,
    homeworks,
  }, testInfo) => {
    await sectionRun(async () => {
      await jumpToSection(page, section.path, /作业|Homework/i, "#homework");

      await page
        .getByRole("button", {
          name: new RegExp(escapeForRegExp(homeworks[0].title)),
        })
        .first()
        .click();

      const dialog = detailDialog(page);
      await expect(dialog).toBeVisible();
      await expectHomeworkDetailOrder(dialog);
      await expectSingleColumnDiscussion(dialog);
      await expect(dialog.getByText(/评论|Comments/i).first()).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/homework-discuss");
      await expectComfortablePopupWidth(page, dialog);
      await expectIconOnlyCloseButton(dialog);
      await closeDetailDialog(page, dialog);
    });
  });

  test("移动端作业详情弹窗纵向排布且不产生横向溢出", async ({
    sectionRun,
    page,
    section,
    homeworks,
  }) => {
    await sectionRun(async () => {
      await page.setViewportSize({ height: 844, width: 390 });
      await jumpToSection(page, section.path, /作业|Homework/i, "#homework");

      await page
        .getByRole("button", {
          name: new RegExp(escapeForRegExp(homeworks[0].title)),
        })
        .first()
        .click();

      const dialog = detailDialog(page);
      await expect(dialog).toBeVisible();
      await expectDetailDialogFitsViewport(page, dialog);
      await expectHomeworkDetailOrder(dialog);
      await expectSingleColumnDiscussion(dialog);
      await closeDetailDialog(page, dialog);
    });
  });

  test("已登录用户可创建作业并看到默认状态", async ({
    sectionRun,
    page,
    section,
    account,
    isolatedWorker,
  }, testInfo) => {
    await sectionRun(
      async () => {
        const db = isolatedWorker.database.owner;
        test.setTimeout(60_000);

        expect(await readHomeworks(db, section.id)).toEqual([]);
        await jumpToSection(page, section.path, /作业|Homework/i, "#homework");

        // Create
        const showCreate = page
          .getByRole("button", { name: /新建|创建作业|Create/i })
          .first();
        await showCreate.click();
        const createDialog = page
          .locator('[data-slot="dialog-content"]')
          .first();
        await expect(createDialog).toBeVisible({ timeout: 5_000 });

        const title = `e2e-section-hw-${Date.now()}`;
        await createDialog.getByTestId("section-homework-title").fill(title);
        const createdHomeworkResponse = await observeAction(
          () =>
            page.waitForResponse(
              (r) =>
                r.url().endsWith("/api/community/section-homeworks") &&
                r.request().method() === "POST",
            ),
          () =>
            createDialog
              .getByRole("button", { name: /创建作业|Create homework/i })
              .click(),
        );
        expect(createdHomeworkResponse.status()).toBe(201);
        const createResponseBody = (await createdHomeworkResponse.json()) as {
          id: string;
        };
        expect(createResponseBody.id).toEqual(expect.any(String));
        const homeworkId = createResponseBody.id;
        await expect
          .poll(() => readHomeworks(db, section.id))
          .toMatchObject([
            {
              id: homeworkId,
              title,
              sectionId: section.id,
              createdById: account.id,
              isMajor: false,
              requiresTeam: false,
              deletedAt: null,
            },
          ]);
        await waitForUiSettled(page);

        const hwCard = page
          .getByRole("button", { name: new RegExp(escapeForRegExp(title)) })
          .first();
        await expect(hwCard).toBeVisible();

        // homework.title is displayed
        await expect(hwCard.getByText(title)).toBeVisible();
        await captureStepScreenshot(page, testInfo, "section/homework-created");
        expect(
          await readHomeworkCompletion(db, account.id, homeworkId),
        ).toBeNull();
      },
      {
        calendarMessages: [{ type: "section", sectionId: section.id }],
        auditActions: { homework_create: 1 },
      },
    );
  });

  test("已登录用户可完成预置作业且刷新后保留完成状态", async ({
    sectionRun,
    page,
    section,
    account,
    isolatedWorker,
  }, testInfo) => {
    await sectionRun(
      async () => {
        const db = isolatedWorker.database.owner;
        const homework = await db.homework.create({
          data: {
            sectionId: section.id,
            createdById: account.id,
            title: "Independently completed section homework",
            isMajor: true,
            requiresTeam: true,
            submissionDueAt: new Date("2099-01-03T12:30:00+08:00"),
          },
        });
        const homeworkId = homework.id;
        const before = await readHomeworks(db, section.id);
        await jumpToSection(page, section.path, /作业|Homework/i, "#homework");
        const hwCard = page
          .getByRole("button", { name: homework.title, exact: true })
          .first();
        await hwCard.click();
        const homeworkPopout = detailDialog(page);
        await expect(homeworkPopout).toBeVisible();
        const deadline = homeworkPopout.getByTestId(
          "homework-deadline-summary",
        );
        const reminder = deadline.getByText(/还剩|left/i);
        await expect(reminder).toBeVisible();
        // The only write is completing the independently prepared homework.
        const completionButton = homeworkPopout
          .getByRole("button", {
            name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
          })
          .first();
        await expect(completionButton).toBeVisible();
        expect(
          await readHomeworkCompletion(db, account.id, homeworkId),
        ).toBeNull();
        await expect(completionButton).toHaveAccessibleName(
          /标记为完成|Mark as complete/i,
        );
        const response = await observeAction(
          () =>
            page.waitForResponse(
              (r) =>
                r
                  .url()
                  .endsWith(
                    `/api/workspace/homeworks/${homeworkId}/completion`,
                  ) && r.request().method() === "PUT",
            ),
          () => completionButton.click(),
        );
        expect(response.status()).toBe(200);
        const completionBody = await response.json();
        expect(completionBody).toMatchObject({
          completed: true,
          completedAt: expect.any(String),
        });
        await expect
          .poll(() => readHomeworkCompletion(db, account.id, homeworkId))
          .toMatchObject({
            userId: account.id,
            homeworkId,
            completedAt: expect.any(Date),
          });
        await expect(completionButton).toHaveAccessibleName(
          /取消完成|Mark as incomplete/i,
        );
        await expect(reminder).toHaveCount(0);
        await expect(deadline).toContainText("12:30");
        const completed = await db.homeworkCompletion.findUniqueOrThrow({
          where: { userId_homeworkId: { userId: account.id, homeworkId } },
        });
        expect(new Date(completionBody.completedAt).getTime()).toBe(
          completed.completedAt.getTime(),
        );
        const facts = homeworkPopout.getByTestId("homework-secondary-details");
        await expect(facts).toContainText(/已完成|Completed/i);
        await expect(facts).toContainText(/大作业|Major/i);
        await expect(facts).toContainText(/组队|Team/i);
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForUiSettled(page);
        await hwCard.click();
        await expect(completionButton).toHaveAccessibleName(
          /取消完成|Mark as incomplete/i,
        );
        await captureStepScreenshot(
          page,
          testInfo,
          "section/homework-completion-toggled",
        );

        await expect(reminder).toHaveCount(0);
        expect(
          await readHomeworkCompletion(db, account.id, homeworkId),
        ).toEqual(completed);
        expect(await readHomeworks(db, section.id)).toEqual(before);
      },
      { calendarMessages: [{ type: "user", userId: account.id }] },
    );
  });

  test("已登录用户可删除预置作业且刷新后不再显示", async ({
    sectionRun,
    page,
    section,
    account,
    isolatedWorker,
  }) => {
    await sectionRun(
      async () => {
        const db = isolatedWorker.database.owner;
        const homework = await db.homework.create({
          data: {
            sectionId: section.id,
            createdById: account.id,
            title: "Independently deleted section homework",
          },
        });
        const homeworkId = homework.id;
        await jumpToSection(page, section.path, /作业|Homework/i, "#homework");
        const hwCard = page
          .getByRole("button", { name: homework.title, exact: true })
          .first();
        await hwCard.click();
        const homeworkPopout = detailDialog(page);
        await expect(homeworkPopout).toBeVisible();
        // Delete
        await selectHomeworkAction(page, homeworkPopout, /删除|Delete/i);
        const deleteDialog = page
          .locator('[data-slot="alert-dialog-content"]')
          .last();
        await expect(deleteDialog).toBeVisible();
        const response = await observeAction(
          () =>
            page.waitForResponse(
              (r) =>
                r
                  .url()
                  .endsWith(`/api/community/section-homeworks/${homeworkId}`) &&
                r.request().method() === "DELETE",
            ),
          () =>
            deleteDialog.getByRole("button", { name: /删除|Delete/i }).click(),
        );
        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual({ success: true });
        await expect(hwCard).toHaveCount(0);
        await expect
          .poll(() => readHomeworks(db, section.id))
          .toMatchObject([
            {
              ...homework,
              updatedById: account.id,
              updatedAt: expect.any(Date),
              deletedById: account.id,
              deletedAt: expect.any(Date),
            },
          ]);
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForUiSettled(page);
        await expect(page.getByTestId("section-homeworks-list")).toBeVisible();
        await expect(hwCard).toHaveCount(0);
      },
      {
        calendarMessages: [{ type: "section", sectionId: section.id }],
        auditActions: { homework_delete: 1 },
      },
    );
  });

  test("可编辑班级作业的截止日期、说明、重要和组队标记", async ({
    sectionRun,
    page,
    section,
    account,
    isolatedWorker,
  }, testInfo) => {
    await sectionRun(
      async () => {
        const db = isolatedWorker.database.owner;
        test.setTimeout(60_000);

        const title = `e2e-section-hw-edit-${Date.now()}`;
        const homework = await db.homework.create({
          data: {
            sectionId: section.id,
            createdById: account.id,
            title,
            submissionDueAt: null,
          },
        });
        const homeworkId = homework.id;

        await jumpToSection(page, section.path, /作业|Homework/i, "#homework");

        const hwCard = page
          .getByRole("button", { name: new RegExp(escapeForRegExp(title)) })
          .first();
        await expect(hwCard).toBeVisible();
        await hwCard.click();

        const detailDialog = page
          .locator('[data-slot="dialog-content"]')
          .first();
        await expect(detailDialog).toBeVisible();
        await selectHomeworkAction(
          page,
          detailDialog,
          /Edit details|编辑信息/i,
        );

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
        await expect(advancedSettings).toHaveAttribute(
          "aria-expanded",
          "false",
        );
        await advancedSettings.click();
        await editForm
          .getByRole("checkbox", { name: /Major assignment|大作业/i })
          .click();
        await editForm
          .getByRole("checkbox", { name: /Team required|需要组队/i })
          .click();

        const editResponse = await observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response
                  .url()
                  .endsWith(`/api/community/section-homeworks/${homeworkId}`) &&
                response.request().method() === "PATCH",
            ),
          () =>
            editForm
              .getByRole("button", { name: /Save changes|保存修改/i })
              .click(),
        );
        expect(editResponse.status()).toBe(200);
        await expect
          .poll(() => readHomeworks(db, section.id))
          .toMatchObject([
            {
              id: homeworkId,
              title,
              sectionId: section.id,
              createdById: account.id,
              updatedById: account.id,
              submissionDueAt: new Date("2026-12-31T23:59:00+08:00"),
              isMajor: true,
              requiresTeam: true,
              description: { content: description },
            },
          ]);
        await expect(
          editForm.getByRole("button", { name: /Save changes|保存修改/i }),
        ).toHaveCount(0, { timeout: 15_000 });

        await expect(detailDialog.getByText(description)).toBeVisible();
        const deadlineSummary = detailDialog.getByTestId(
          "homework-deadline-summary",
        );
        await expect(deadlineSummary).toContainText(
          /2026-12-31|2026\/12\/31|12\/31\/26|12月31日|Dec 31/,
        );
        await expect(deadlineSummary).toContainText(/23:59|11:59 PM/);

        // The collapsible "More details" trigger is gone; the same major/team
        // flags now live in the facts table and must stay out of the due block.
        const factsTable = detailDialog.getByTestId(
          "homework-secondary-details",
        );
        await expect(factsTable).toContainText(/Major assignment|大作业/i);
        await expect(factsTable).toContainText(/Team required|需要组队/i);
        await expect(deadlineSummary).not.toContainText(
          /Major assignment|大作业/i,
        );
        await expect(deadlineSummary).not.toContainText(
          /Team required|需要组队/i,
        );
        await captureStepScreenshot(
          page,
          testInfo,
          "section/homework-edited-full-fields",
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForUiSettled(page);
        await hwCard.click();
        await expect(detailDialog.getByText(description)).toBeVisible();
        await expect(deadlineSummary).toContainText(/23:59|11:59 PM/);
        await expect(factsTable).toContainText(/Major assignment|大作业/i);
        await expect(factsTable).toContainText(/Team required|需要组队/i);
      },
      {
        calendarMessages: [{ type: "section", sectionId: section.id }],
        auditActions: {
          homework_update: 1,
          description_edit: 1,
        },
      },
    );
  });

  test("作业评论永久链接打开目标评论", async ({
    sectionRun,
    page,
    section,
    account,
    isolatedWorker,
  }, testInfo) => {
    await sectionRun(async () => {
      test.setTimeout(60_000);

      const db = isolatedWorker.database.owner;
      const title = "Known homework permalink target";
      const body = "Known homework permalink comment";
      const { homework, comment } = await db.$transaction(async (tx) => {
        const homework = await tx.homework.create({
          data: { sectionId: section.id, createdById: account.id, title },
        });
        const id = crypto.randomUUID();
        const comment = await tx.comment.create({
          data: {
            id,
            rootId: id,
            userId: account.id,
            homeworkId: homework.id,
            body,
          },
        });
        return { homework, comment };
      });
      const homeworkId = homework.id;
      const commentId = comment.id;
      const before = await readHomeworks(db, section.id);

      await gotoAndWaitForReady(page, `/community/comments/${commentId}`);
      await expect(page).toHaveURL(
        new RegExp(
          `/catalog/sections/${section.jwId}\\?homeworkId=${escapeForRegExp(homeworkId)}#comment-${escapeForRegExp(commentId)}$`,
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
      expect(await readHomeworks(db, section.id)).toEqual(before);
      expect(await db.comment.findUnique({ where: { id: commentId } })).toEqual(
        comment,
      );
    });
  });
});

test("homework.section-completed-deadline-display", async ({
  sectionRun,
  page,
  section,
  account,
  isolatedWorker,
}) => {
  await sectionRun(async () => {
    const db = isolatedWorker.database.owner;
    const homeworks = await db.$transaction(async (tx) => {
      const records = [];
      for (const completed of [false, true]) {
        const homework = await tx.homework.create({
          data: {
            sectionId: section.id,
            createdById: account.id,
            title: `Known ${completed ? "completed" : "incomplete"} section homework`,
            isMajor: true,
            requiresTeam: true,
            submissionDueAt: new Date("2099-01-03T12:30:00+08:00"),
          },
        });
        if (completed) {
          await tx.homeworkCompletion.create({
            data: { userId: account.id, homeworkId: homework.id },
          });
        }
        records.push({ ...homework, completed });
      }
      return records;
    });
    const before = await readHomeworks(db, section.id);
    const completionsBefore = await db.homeworkCompletion.findMany();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const homework of homeworks) {
        await gotoAndWaitForReady(page, `${section.path}#homework`);
        const { title, completed } = homework;
        const list = page.getByTestId(
          width >= 768 ? "section-homeworks-list" : "section-homeworks-items",
        );
        const summary =
          width >= 768
            ? list.getByRole("row").filter({ hasText: title })
            : list.locator('[data-slot="item"]').filter({ hasText: title });
        await expect(summary).toContainText("12:30");
        await expect(summary).toContainText(/重要|大作业|Major/i);
        await expect(summary).toContainText(/组队|团队|Team/i);
        await summary.getByRole("button", { name: title, exact: true }).click();
        const dialog = page.getByRole("dialog", { name: title, exact: true });
        const deadline = dialog.getByTestId("homework-deadline-summary");
        const reminder = deadline.getByText(/还剩|left/i);
        if (completed) await expect(reminder).toHaveCount(0);
        else await expect(reminder).toBeVisible();
        const completion = dialog.getByRole("button", {
          name: completed
            ? /取消完成|Mark as incomplete/i
            : /标记为完成|Mark as complete/i,
        });
        await expect(completion).toBeEnabled();
        await expect(deadline).toContainText("12:30");
        const state = dialog.getByTestId("homework-secondary-details");
        if (completed) await expect(state).toContainText(/已完成|Completed/i);
        await expect(state).toContainText(/大作业|Major/i);
        await expect(state).toContainText(/组队|Team/i);
        await page.keyboard.press("Escape");
        await expect(summary).toContainText("12:30");
        await expect(summary).toContainText(/重要|大作业|Major/i);
        await expect(summary).toContainText(/组队|团队|Team/i);
        await summary.getByRole("button", { name: title, exact: true }).click();
        if (completed) await expect(reminder).toHaveCount(0);
        else await expect(reminder).toBeVisible();
        await expect(completion).toBeEnabled();
        await page.keyboard.press("Escape");
      }
    }
    expect(await readHomeworks(db, section.id)).toEqual(before);
    expect(await db.homeworkCompletion.findMany()).toEqual(completionsBefore);
  });
});

test("取消预置作业的完成状态会恢复截止提醒", async ({
  sectionRun,
  page,
  section,
  account,
  isolatedWorker,
}) => {
  await sectionRun(
    async () => {
      const db = isolatedWorker.database.owner;
      const homework = await db.homework.create({
        data: {
          sectionId: section.id,
          createdById: account.id,
          title: "Independently reopened section homework",
          isMajor: true,
          requiresTeam: true,
          submissionDueAt: new Date("2099-01-03T12:30:00+08:00"),
          homeworkCompletions: { create: { userId: account.id } },
        },
      });
      const before = await readHomeworks(db, section.id);
      await jumpToSection(page, section.path, /作业|Homework/i, "#homework");
      const card = page
        .getByRole("button", { name: homework.title, exact: true })
        .first();
      await card.click();
      const dialog = detailDialog(page);
      const deadline = dialog.getByTestId("homework-deadline-summary");
      const reminder = deadline.getByText(/还剩|left/i);
      await expect(reminder).toHaveCount(0);
      const response = await observeAction(
        () =>
          page.waitForResponse(
            (response) =>
              response
                .url()
                .endsWith(
                  `/api/workspace/homeworks/${homework.id}/completion`,
                ) && response.request().method() === "PUT",
          ),
        () =>
          dialog
            .getByRole("button", { name: /取消完成|Mark as incomplete/i })
            .click(),
      );
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        completed: false,
        completedAt: null,
      });
      await expect(reminder).toBeVisible();
      await expect(deadline).toContainText("12:30");
      await expect(
        dialog.getByRole("button", { name: /标记为完成|Mark as complete/i }),
      ).toBeEnabled();
      const state = dialog.getByTestId("homework-secondary-details");
      await expect(state).toContainText(/大作业|Major/i);
      await expect(state).toContainText(/组队|Team/i);
      expect(
        await readHomeworkCompletion(db, account.id, homework.id),
      ).toBeNull();
      expect(await readHomeworks(db, section.id)).toEqual(before);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForUiSettled(page);
      await card.click();
      await expect(reminder).toBeVisible();
      expect(
        await readHomeworkCompletion(db, account.id, homework.id),
      ).toBeNull();
    },
    { calendarMessages: [{ type: "user", userId: account.id }] },
  );
});
