import { expect } from "@playwright/test";
import { test } from "../../../../utils/homework-fixture";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";

test.describe("仪表盘作业", () => {
  test.describe.configure({ mode: "parallel" });

  test("homework.mobile-toolbar-priority", { tag: "@Homework/Web" }, async ({
    page,
    homeworks: _homeworks,
    homeworkRun,
  }) => {
    await homeworkRun(
      async () => {
        await page.addInitScript(() => {
          localStorage.removeItem("life-ustc-workspace-view-mode");
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoAndWaitForReady(page, "/workspace/homeworks");

        const incomplete = page
          .getByRole("radio", { name: /未完成|Incomplete/i })
          .first();
        const add = page.getByTestId("workspace-homeworks-add");
        await expect(incomplete).toBeVisible();
        await expect(add).toBeVisible();
        await expect(
          page.getByTestId("workspace-homeworks-view-menu"),
        ).toHaveCount(0);

        const addBox = await add.boundingBox();
        expect(addBox?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(addBox?.width ?? 0).toBeGreaterThanOrEqual(44);
        const filterBox = await incomplete.boundingBox();
        expect(filterBox?.height).toBeGreaterThanOrEqual(44);
        expect(filterBox?.width).toBeGreaterThanOrEqual(44);

        const all = page.getByRole("radio", { name: /全部|All/i }).first();
        await all.click();
        await expect(all).toHaveAttribute("aria-checked", "true");

        await gotoAndWaitForReady(
          page,
          "/workspace/homeworks?homeworkView=list",
        );
        await expect(
          page.getByTestId("workspace-homeworks-cards"),
        ).toBeVisible();
        await expect(page.getByTestId("workspace-homeworks-list")).toBeHidden();
        const homeworkItem = page
          .getByTestId("workspace-homeworks-cards")
          .locator('[data-slot="item"]')
          .first();
        await expect(homeworkItem).toBeVisible();
        await expect(
          homeworkItem.locator('[data-slot="item-content"]'),
        ).toBeVisible();
        await expect(
          homeworkItem.locator('[data-slot="item-actions"]'),
        ).toBeVisible();
        for (const control of await homeworkItem
          .locator('[data-slot="item-actions"]')
          .getByRole("button")
          .all()) {
          const box = await control.boundingBox();
          expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });

  test("移动端新建作业保留内部滚动和可见底部操作", {
    tag: "@Homework/Web",
  }, async ({ page, academic: _academic, homeworkRun }) => {
    await homeworkRun(
      async () => {
        await page.setViewportSize({ height: 568, width: 320 });
        await gotoAndWaitForReady(page, "/workspace/homeworks");

        await page.getByTestId("workspace-homeworks-add").first().click();
        const createDialog = page
          .getByRole("dialog", { name: /新建作业|New Homework/i })
          .first();
        await expect(createDialog).toBeVisible();
        const viewportHeight = page.viewportSize()?.height ?? 568;
        const dialogBox = await createDialog.boundingBox();
        const footer = createDialog.locator('[data-slot="dialog-footer"]');
        const closeButton = createDialog.getByRole("button", { name: "Close" });
        const [footerBox, closeBox] = await Promise.all([
          footer.boundingBox(),
          closeButton.boundingBox(),
        ]);
        expect(dialogBox).not.toBeNull();
        expect(footerBox).not.toBeNull();
        expect(closeBox).not.toBeNull();
        if (!dialogBox || !footerBox || !closeBox) {
          throw new Error("Expected the mobile homework dialog bounds");
        }
        expect(dialogBox.y).toBeGreaterThanOrEqual(0);
        expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(
          viewportHeight,
        );
        expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
          viewportHeight,
        );
        expect(
          await createDialog.evaluate((element) => element.scrollTop),
        ).toBe(0);
        await expect(footer).toBeInViewport();
        await expect(closeButton).toBeInViewport();
        const submit = createDialog.getByTestId("workspace-homework-create");
        await expect(submit).toBeInViewport();
        const dueDateShortcuts = createDialog.getByRole("button", {
          name: /常用截止时间|Common deadlines/i,
        });
        await dueDateShortcuts.click();
        await expect(
          page
            .getByRole("menuitem", { name: /下周|Next (Fri|Sat|Sun)/i })
            .first(),
        ).toBeVisible();
        await page.keyboard.press("Escape");

        const scrollViewport = createDialog
          .locator('[data-slot="scroll-area-viewport"]')
          .first();
        const metrics = await scrollViewport.evaluate((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        }));
        expect(metrics.clientHeight).toBeGreaterThan(0);
        const scrollBox = await scrollViewport.boundingBox();
        expect(scrollBox).not.toBeNull();
        if (!scrollBox) {
          throw new Error("Expected the homework form scroll area bounds");
        }
        expect(scrollBox.y + scrollBox.height).toBeLessThanOrEqual(
          footerBox.y + 1,
        );
        if (metrics.scrollHeight > metrics.clientHeight) {
          const scrollTopBefore = await scrollViewport.evaluate(
            (element) => element.scrollTop,
          );
          await scrollViewport.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          const scrollTopAfter = await scrollViewport.evaluate(
            (element) => element.scrollTop,
          );
          const maxScrollTop = metrics.scrollHeight - metrics.clientHeight;
          if (scrollTopBefore < maxScrollTop - 1) {
            expect(scrollTopAfter).toBeGreaterThan(scrollTopBefore);
          }
          expect(scrollTopAfter).toBeGreaterThanOrEqual(maxScrollTop - 1);
        }
        await expect(submit).toBeInViewport();
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });

  test("移动端作业详情长内容保持底部操作可达", {
    tag: "@Homework/Web",
  }, async ({ page, academic, homeworkRun, storedHomeworks }) => {
    await homeworkRun(
      async () => {
        test.setTimeout(90_000);
        await page.addInitScript(() => {
          localStorage.removeItem("life-ustc-workspace-view-mode");
        });
        await page.setViewportSize({ height: 568, width: 320 });
        await gotoAndWaitForReady(page, "/workspace/homeworks");

        const title = `e2e-workspace-homework-mobile-${Date.now()}-${"长标题".repeat(30)}`;
        const description = `${"这是用于验证仪表盘作业详情滚动区域的长说明。 ".repeat(24)}\n\nworkspace-homework-mobile-content-marker`;

        await page.getByTestId("workspace-homeworks-add").first().click();
        const createDialog = page.getByRole("dialog", {
          name: /新建作业|New Homework/i,
        });
        await expect(createDialog).toBeVisible();
        await createDialog.getByTestId("workspace-homework-title").fill(title);
        await createDialog
          .getByRole("textbox", { name: /说明|Details/i })
          .fill(description);
        await createDialog.getByTestId("workspace-homework-create").click();
        await expect(visibleText(page, title)).toBeVisible({ timeout: 15_000 });
        await page.keyboard.press("Escape");
        await expect(createDialog).toHaveCount(0);

        await page
          .getByRole("button", { name: new RegExp(title) })
          .first()
          .click();
        const detailDialog = page
          .locator('[data-slot="dialog-content"]')
          .first();
        await expect(detailDialog).toBeVisible();
        await expect(
          detailDialog.getByText("workspace-homework-mobile-content-marker"),
        ).toBeVisible();
        await expect(
          detailDialog.locator('a[href*="/catalog/sections/"]').first(),
        ).toBeVisible();

        const viewportHeight = page.viewportSize()?.height ?? 568;
        const dialogBox = await detailDialog.boundingBox();
        const footer = detailDialog.locator('[data-slot="dialog-footer"]');
        const footerBox = await footer.boundingBox();
        expect(dialogBox).not.toBeNull();
        expect(footerBox).not.toBeNull();
        if (!dialogBox || !footerBox) {
          throw new Error("Expected the mobile homework detail bounds");
        }
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
        await expect(completion).toBeVisible();
        const completionBox = await completion.boundingBox();
        expect(completionBox).not.toBeNull();
        expect(completionBox?.width ?? 0).toBeGreaterThanOrEqual(240);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);

        const persisted = await storedHomeworks(academic.section.id);
        expect(persisted).toHaveLength(1);
        expect(persisted[0]).toMatchObject({
          title,
          description: { content: description },
        });
      },
      {
        calendarMessages: [{ type: "section", sectionId: academic.section.id }],
        calendarTokenCreated: false,
        auditActions: { homework_create: 1 },
      },
    );
  });
});
