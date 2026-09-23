import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { cleanupHomeworksForE2e } from "../../../../utils/homeworks";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../utils/subscriptions";

test.describe("仪表盘作业", () => {
  test.describe.configure({ mode: "serial" });

  test("移动端保留直接筛选并将视图切换收进紧凑菜单", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.removeItem("life-ustc-workspace-view-mode");
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks-mobile-toolbar",
    });

    const incomplete = page
      .getByRole("radio", { name: /未完成|Incomplete/i })
      .first();
    const add = page.getByTestId("workspace-homeworks-add");
    await expect(incomplete).toBeVisible();
    await expect(add).toBeVisible();
    await expect(page.getByTestId("workspace-homeworks-view-menu")).toHaveCount(
      0,
    );

    for (const control of [incomplete, add]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }

    const all = page.getByRole("radio", { name: /全部|All/i }).first();
    await all.click();
    await expect(all).toHaveAttribute("aria-checked", "true");

    await gotoAndWaitForReady(page, "/workspace/homeworks?homeworkView=list");
    await expect(page.getByTestId("workspace-homeworks-cards")).toBeVisible();
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

    await captureStepScreenshot(page, testInfo, "homeworks/mobile-toolbar");
  });

  test("移动端新建作业保留内部滚动和可见底部操作", async ({ page }) => {
    await page.setViewportSize({ height: 568, width: 320 });
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
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
    expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(viewportHeight);
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(viewportHeight);
    expect(await createDialog.evaluate((element) => element.scrollTop)).toBe(0);
    await expect(footer).toBeInViewport();
    await expect(closeButton).toBeInViewport();
    const submit = createDialog.getByTestId("workspace-homework-create");
    await expect(submit).toBeInViewport();
    const dueDateShortcuts = createDialog.getByRole("button", {
      name: /常用截止时间|Common deadlines/i,
    });
    await dueDateShortcuts.click();
    await expect(
      page.getByRole("menuitem", { name: /下周|Next (Fri|Sat|Sun)/i }).first(),
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
    expect(scrollBox.y + scrollBox.height).toBeLessThanOrEqual(footerBox.y + 1);
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
  });

  test("移动端作业详情长内容保持底部操作可达", async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      localStorage.removeItem("life-ustc-workspace-view-mode");
    });
    await page.setViewportSize({ height: 568, width: 320 });
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks");

    const title = `e2e-workspace-homework-mobile-${Date.now()}-${"长标题".repeat(30)}`;
    const description = `${"这是用于验证仪表盘作业详情滚动区域的长说明。 ".repeat(24)}\n\nworkspace-homework-mobile-content-marker`;
    let homeworkId: string | undefined;

    try {
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
      const detailDialog = page.locator('[data-slot="dialog-content"]').first();
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

      homeworkId =
        (await detailDialog.getAttribute("data-homework-id")) ?? undefined;
    } finally {
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });
});
