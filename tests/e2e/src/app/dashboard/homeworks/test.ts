/**
 * E2E tests for the homeworks dashboard (`/workspace/homeworks`)
 *
 * ## Data Represented (homework.yml → cross-section-homework-summary.display.fields)
 * - homework.title
 * - homework.description.content
 * - homework.submissionDueAt (with ETA label)
 * - section.course.namePrimary
 * - homework.isMajor badge
 * - homework.requiresTeam badge
 * - completionStatus (completed/pending)
 * - filter: incomplete / completed / all
 *
 * ## Features
 * - Desktop list rows expose a completion button; mobile uses cards
 * - "View details" link → /catalog/sections/{jwId}?homeworkId={id}#homework
 * - Create homework button → modal form
 *
 * ## Edge Cases
 * - Unauthenticated legacy tab → protected semantic route, then sign-in
 * - Completion toggle calls PUT /api/workspace/homeworks/{id}/completion
 * - Empty state when filter yields no results
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { cleanupHomeworksForE2e } from "../../../../utils/homeworks";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../utils/subscriptions";

test.describe("仪表盘作业", () => {
  test.describe.configure({ mode: "serial" });

  test("未登录旧 homework tab 重定向到语义路径", async ({ page }) => {
    const response = await page.request.get(
      "/?tab=homeworks&homeworkView=list",
      {
        maxRedirects: 0,
      },
    );

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      "/workspace/homeworks?homeworkView=list",
    );
  });

  test("未登录语义路径要求登录", async ({ page }) => {
    const response = await page.request.get("/workspace/homeworks", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe(
      "/account/sign-in?callbackUrl=%2Fworkspace%2Fhomeworks",
    );
  });

  test("登录后显示种子作业及所有必填字段", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    // Switch to All to see all homeworks
    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const hwRow = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(hwRow).toBeVisible();

    // homework.title
    await expect(hwRow.getByText(DEV_SEED.homeworks.title)).toBeVisible();
    await expect(hwRow.getByText(/\d{1,2}:\d{2}/).first()).toBeVisible();

    // section.course.namePrimary appears in the homework subtitle.
    await expect(
      hwRow
        .getByText(DEV_SEED.course.nameCn)
        .or(hwRow.getByText(DEV_SEED.course.nameEn))
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "homeworks/seed-list-fields");
  });

  test("移动端保留直接筛选并将视图切换收进紧凑菜单", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.removeItem("life-ustc-dashboard-view-mode");
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
    const add = page.getByTestId("dashboard-homeworks-add");
    await expect(incomplete).toBeVisible();
    await expect(add).toBeVisible();
    await expect(page.getByTestId("dashboard-homeworks-view-menu")).toHaveCount(
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
    await expect(page.getByTestId("dashboard-homeworks-cards")).toBeVisible();
    await expect(page.getByTestId("dashboard-homeworks-list")).toBeHidden();
    const homeworkItem = page
      .getByTestId("dashboard-homeworks-cards")
      .locator('[data-slot="item"]')
      .first();
    await expect(homeworkItem).toBeVisible();
    await expect(
      homeworkItem.locator('[data-slot="item-content"]'),
    ).toBeVisible();
    await expect(
      homeworkItem.locator('[data-slot="item-actions"]'),
    ).toBeVisible();
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

    await page.getByTestId("dashboard-homeworks-add").first().click();
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
    const submit = createDialog.getByTestId("dashboard-homework-create");
    await expect(submit).toBeInViewport();
    const dueDateShortcuts = createDialog.getByRole("button", {
      name: /截止时间快捷设置|Due date shortcuts/i,
    });
    await dueDateShortcuts.click();
    await expect(
      page.getByRole("menuitem", { name: /一周内提交|Due within a week/i }),
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
      localStorage.removeItem("life-ustc-dashboard-view-mode");
    });
    await page.setViewportSize({ height: 568, width: 320 });
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks");

    const title = `e2e-dashboard-homework-mobile-${Date.now()}-${"长标题".repeat(30)}`;
    const description = `${"这是用于验证仪表盘作业详情滚动区域的长说明。 ".repeat(24)}\n\ndashboard-homework-mobile-content-marker`;
    let homeworkId: string | undefined;

    try {
      await page.getByTestId("dashboard-homeworks-add").first().click();
      const createDialog = page.getByRole("dialog", {
        name: /新建作业|New Homework/i,
      });
      await expect(createDialog).toBeVisible();
      await createDialog.getByTestId("dashboard-homework-title").fill(title);
      await createDialog
        .getByRole("textbox", { name: /说明|Details/i })
        .fill(description);
      await createDialog.getByTestId("dashboard-homework-create").click();
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
        detailDialog.getByText("dashboard-homework-mobile-content-marker"),
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
      expect(dialogBox.y).toBeGreaterThanOrEqual(16);
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(
        viewportHeight - 16,
      );
      expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
        viewportHeight,
      );
      await expect(footer).toBeInViewport();

      const completion = footer.getByRole("button", {
        name: /标记为完成|Mark as complete/i,
      });
      const details = footer.getByRole("link", {
        name: /查看详情|View details/i,
      });
      for (const control of [completion, details]) {
        await expect(control).toBeVisible();
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(240);
      }
      const [completionBox, detailsBox] = await Promise.all([
        completion.boundingBox(),
        details.boundingBox(),
      ]);
      expect(completionBox?.y).toBeLessThan(
        detailsBox?.y ?? Number.POSITIVE_INFINITY,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      const sectionLink = detailDialog
        .locator('a[href*="homeworkId="]')
        .first();
      const href = await sectionLink.getAttribute("href");
      homeworkId = href
        ? (new URL(href, "http://localhost").searchParams.get("homeworkId") ??
          undefined)
        : undefined;
    } finally {
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });

  test("种子协作作业显示重要和团队徽章", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const hwRow = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(hwRow).toBeVisible();
    await expect(hwRow.getByText(/重要|Major|重大/i)).toBeVisible();
    await expect(hwRow.getByText(/团队|Team/i)).toBeVisible();

    await captureStepScreenshot(page, testInfo, "homeworks/major-team-badges");
  });

  test("可在筛选标签之间切换", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });
    await expect(
      visibleText(page, DEV_SEED.homeworks.overdueTitle),
    ).toBeVisible();

    // Completed filter
    const completedTab = page
      .getByRole("radio", { name: /已完成|Completed/i })
      .first();
    await expect(completedTab).toBeVisible();
    await completedTab.click();
    await expect(
      visibleText(page, DEV_SEED.homeworks.completedTitle),
    ).toBeVisible();
    await expect(
      visibleText(page, DEV_SEED.homeworks.overdueTitle),
    ).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "homeworks/filter-completed");

    // All filter
    const allTab = page.getByRole("radio", { name: /全部|All/i }).first();
    await expect(allTab).toBeVisible();
    await allTab.click();
    await expect(
      visibleText(page, DEV_SEED.homeworks.overdueTitle),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "homeworks/filter-all");
  });

  test("桌面端默认显示作业列表", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    await expect(
      page.getByRole("radio", { name: /列表|List|卡片|Cards/i }),
    ).toHaveCount(0);
    await expect(page.getByTestId("dashboard-homeworks-list")).toBeVisible();
    await expect(page.getByTestId("dashboard-homeworks-cards")).toBeHidden();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: DEV_SEED.homeworks.title })
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "homeworks/list-view");
  });

  test("可切换作业完成状态", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    // Switch to "all" filter
    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    await expect(page.getByRole("switch")).toHaveCount(0);

    const row = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(row).toBeVisible();

    const completionButton = row
      .getByRole("button", {
        name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
      })
      .first();
    await expect(completionButton).toBeVisible();

    const before =
      (await completionButton.getAttribute("aria-label"))?.trim() ?? "";

    const completionResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/workspace/homeworks/") &&
        r.url().includes("/completion") &&
        r.status() === 200,
    );
    await completionButton.click();
    await completionResponse;
    await expect(completionButton).not.toHaveAttribute("aria-label", before, {
      timeout: 15_000,
    });

    const after =
      (await completionButton.getAttribute("aria-label"))?.trim() ?? "";
    expect(after).not.toBe(before);
    await captureStepScreenshot(page, testInfo, "homeworks/completion-toggled");

    // Restore
    const restoreResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/workspace/homeworks/") &&
        r.url().includes("/completion") &&
        r.status() === 200,
    );
    await completionButton.click();
    await restoreResponse;
  });

  test("完成状态更新失败显示本地化仪表盘错误", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await page.route(
      /\/api\/workspace\/homeworks\/[^/]+\/completion$/,
      async (route) => {
        await route.fulfill({
          body: JSON.stringify({ error: { message: "forced failure" } }),
          contentType: "application/json",
          status: 500,
        });
      },
    );
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const row = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(row).toBeVisible();

    const completionButton = row
      .getByRole("button", {
        name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
      })
      .first();
    await expect(completionButton).toBeVisible();

    const completionResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/workspace/homeworks/") &&
        r.url().includes("/completion") &&
        r.status() === 500,
    );
    await completionButton.click();
    await completionResponse;

    await expect(
      page.getByText(/更新完成状态失败|Couldn't update completion/i),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "homeworks/completion-error");
  });

  test("查看详情链接到带作业锚点的班级页面", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const detailRow = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await detailRow
      .getByRole("button", { name: new RegExp(DEV_SEED.homeworks.title) })
      .first()
      .click();
    const popout = page.locator('[data-slot="dialog-content"]').first();
    await expect(popout).toBeVisible();
    const sectionLink = popout
      .locator(
        `a[href*="/catalog/sections/${DEV_SEED.section.jwId}?homeworkId="][href$="#homework"]`,
      )
      .first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();

    await expect(page).toHaveURL(
      /\/catalog\/sections\/\d+\?homeworkId=[^&#]+#homework$/,
    );
    await captureStepScreenshot(page, testInfo, "homeworks/view-details");
  });

  test("可以创建新作业", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    const addButton = page.getByTestId("dashboard-homeworks-add").first();
    const title = `e2e-dashboard-homework-${Date.now()}`;
    const titleInput = page.getByTestId("dashboard-homework-title");
    await expect(async () => {
      await expect(addButton).toBeVisible({ timeout: 3_000 });
      await addButton.click();
      await expect(titleInput).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });
    const createDialog = page.locator('[data-slot="dialog-content"]').first();
    await expect(
      createDialog.getByRole("group", { name: /说明|Details/i }),
    ).toBeVisible();
    await expect(
      createDialog.getByRole("group", {
        name: /提交截止|Submission due/i,
      }),
    ).toBeVisible();
    await titleInput.fill(title);

    let releaseCreateRequest: (() => void) | undefined;
    const createRequestHeld = new Promise<void>((resolve) => {
      releaseCreateRequest = resolve;
    });
    let createRequestIntercepted = false;
    let resolveCreateRouteHandled: (() => void) | undefined;
    const createRouteHandled = new Promise<void>((resolve) => {
      resolveCreateRouteHandled = resolve;
    });
    const createRoutePattern = "**/workspace/homeworks**";
    await page.route(createRoutePattern, async (route) => {
      if (
        route.request().method() !== "POST" ||
        !route.request().url().includes("createHomework")
      ) {
        await route.continue();
        return;
      }
      createRequestIntercepted = true;
      await createRequestHeld;
      try {
        await route.continue();
      } finally {
        resolveCreateRouteHandled?.();
      }
    });
    try {
      await page.getByTestId("dashboard-homework-create").click();
      await expect(
        createDialog.locator('[data-slot="field"][data-disabled="true"]'),
      ).toHaveCount(6);
    } finally {
      releaseCreateRequest?.();
      if (createRequestIntercepted) await createRouteHandled;
      await page.unroute(createRoutePattern);
    }

    await expect(visibleText(page, title)).toBeVisible({
      timeout: 15_000,
    });
    await captureStepScreenshot(page, testInfo, "homeworks/created");
  });

  test("新建作业展示可折叠的英文填写规范", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    const localeResponse = await page.request.post("/api/account/preferences", {
      data: { locale: "en-us" },
    });
    expect(localeResponse.status()).toBe(200);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page.getByTestId("dashboard-homeworks-add").first().click();
    const createDialog = page.locator('[data-slot="dialog-content"]').first();
    const titleInput = createDialog.getByTestId("dashboard-homework-title");
    await expect(titleInput).toHaveAttribute(
      "placeholder",
      "e.g., 第一次作业 / 期中论文作业",
    );
    await expect(
      createDialog.getByRole("textbox", { name: "Details" }),
    ).toHaveAttribute("placeholder", /题目：/);

    const trigger = createDialog.getByTestId(
      "dashboard-homework-style-guide-trigger",
    );
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    const guide = createDialog.getByTestId(
      "dashboard-homework-style-guide-content",
    );
    await expect(guide).toBeVisible();
    await expect(guide).toContainText("第{N}次作业");
    await expect(guide).toContainText("{主题}作业");
    await expect(guide).toContainText(
      "Avoid chapter-only titles such as 第一章作业",
    );
    await expect(guide).toContainText("Do not include the course name or code");
    await expect(guide.locator("pre")).toContainText(
      "- 题目：...\n- 提交方式：...\n- 提交地址：...\n- 备注：...",
    );
    await expect(guide).toContainText("never blocks saving");
    await expect(
      createDialog.getByTestId("dashboard-homework-create"),
    ).toBeVisible();
    await captureStepScreenshot(
      page,
      testInfo,
      "homeworks/style-guide-desktop",
    );
  });

  test("创建作业时可设置重要、组队、截止日期和说明", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    const addButton = page.getByTestId("dashboard-homeworks-add").first();
    const title = `e2e-dashboard-hw-full-${Date.now()}`;
    const description = `e2e-dashboard-hw-description-${Date.now()}`;
    const dueAt = "2026-12-31T23:59";
    const titleInput = page.getByTestId("dashboard-homework-title");
    await expect(async () => {
      await expect(addButton).toBeVisible({ timeout: 3_000 });
      await addButton.click();
      await expect(titleInput).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

    let homeworkId: string | undefined;
    const createDialog = page.locator('[data-slot="dialog-content"]').first();
    await titleInput.fill(title);
    await createDialog
      .getByRole("textbox", { name: /Details|说明/i })
      .fill(description);
    await createDialog
      .getByRole("textbox", { name: /Submission due|提交截止/i })
      .fill(dueAt);
    await createDialog
      .getByRole("checkbox", { name: /Major assignment|大作业/i })
      .click();
    await createDialog
      .getByRole("checkbox", { name: /Team required|需要组队/i })
      .click();

    try {
      await page.getByTestId("dashboard-homework-create").click();
      const row = page.getByRole("row").filter({ hasText: title }).first();
      await expect(row).toBeVisible({ timeout: 15_000 });

      await page.keyboard.press("Escape");
      await expect(
        page.locator('[data-slot="dialog-content"]').first(),
      ).toHaveCount(0, { timeout: 5_000 });

      await expect(row.getByText(/Major assignment|大作业/i)).toBeVisible();
      await expect(row.getByText(/Team required|需要组队/i)).toBeVisible();

      await expect(row).toContainText(
        /2026-12-31|2026\/12\/31|12月31日|Dec 31/,
      );
      await expect(row).toContainText(/23:59|11:59 PM/);

      await row.getByRole("button", { name: new RegExp(title) }).click();
      const detailDialog = page.locator('[data-slot="dialog-content"]').first();
      await expect(detailDialog).toBeVisible();
      await expect(detailDialog.getByText(description)).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "homeworks/created-full-fields",
      );

      const sectionLink = detailDialog
        .locator('a[href*="homeworkId="]')
        .first();
      const href = await sectionLink.getAttribute("href");
      homeworkId = href
        ? (new URL(href, "http://localhost").searchParams.get("homeworkId") ??
          undefined)
        : undefined;
    } finally {
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });
});
