/**
 * E2E tests for the homeworks dashboard (`/dashboard/homeworks`)
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
 * - Hover card to reveal completion button
 * - "View details" link → /sections/{jwId}/homework#homework-{id}
 * - Create homework button → modal form
 *
 * ## Edge Cases
 * - Unauthenticated legacy tab → protected semantic route, then sign-in
 * - Completion toggle calls PUT /api/homeworks/{id}/completion
 * - Empty state when filter yields no results
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { cleanupHomeworksForE2e } from "../../../../utils/homeworks";
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
      "/dashboard/homeworks?homeworkView=list",
    );
  });

  test("未登录语义路径要求登录", async ({ page }) => {
    const response = await page.request.get("/dashboard/homeworks", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe(
      "/signin?callbackUrl=%2Fdashboard%2Fhomeworks",
    );
  });

  test("登录后显示种子作业及所有必填字段", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    // Switch to All to see all homeworks
    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const hwCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(hwCard).toBeVisible();

    // homework.title
    await expect(hwCard.getByText(DEV_SEED.homeworks.title)).toBeVisible();
    await expect(hwCard.getByText(/\d{1,2}:\d{2}/).first()).toBeVisible();

    // section.course.namePrimary appears in the homework subtitle.
    await expect(
      hwCard
        .getByText(DEV_SEED.course.nameCn)
        .or(hwCard.getByText(DEV_SEED.course.nameEn))
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "homeworks/seed-card-fields");
  });

  test("移动端保留直接筛选并将视图切换收进紧凑菜单", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.removeItem("life-ustc-dashboard-view-mode");
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
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

    await gotoAndWaitForReady(page, "/dashboard/homeworks?homeworkView=list");
    await expect(page.getByTestId("dashboard-homeworks-cards")).toBeVisible();
    await expect(page.getByTestId("dashboard-homeworks-list")).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await captureStepScreenshot(page, testInfo, "homeworks/mobile-toolbar");
  });

  test("种子协作作业显示重要和团队徽章", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const hwCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(hwCard).toBeVisible();
    await expect(hwCard.getByText(/重要|Major|重大/i)).toBeVisible();
    await expect(hwCard.getByText(/团队|Team/i)).toBeVisible();

    await captureStepScreenshot(page, testInfo, "homeworks/major-team-badges");
  });

  test("可在筛选标签之间切换", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });
    await expect(page.getByText(DEV_SEED.homeworks.overdueTitle)).toBeVisible();

    // Completed filter
    const completedTab = page
      .getByRole("radio", { name: /已完成|Completed/i })
      .first();
    await expect(completedTab).toBeVisible();
    await completedTab.click();
    await expect(
      page.getByText(DEV_SEED.homeworks.completedTitle),
    ).toBeVisible();
    await expect(page.getByText(DEV_SEED.homeworks.overdueTitle)).toHaveCount(
      0,
    );
    await captureStepScreenshot(page, testInfo, "homeworks/filter-completed");

    // All filter
    const allTab = page.getByRole("radio", { name: /全部|All/i }).first();
    await expect(allTab).toBeVisible();
    await allTab.click();
    await expect(page.getByText(DEV_SEED.homeworks.overdueTitle)).toBeVisible();
    await captureStepScreenshot(page, testInfo, "homeworks/filter-all");
  });

  test("可切换到列表视图并持久化偏好", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    await expect(page.getByTestId("dashboard-homeworks-cards")).toBeVisible();
    await page.getByRole("radio", { name: /列表|List/i }).click();
    await expect(page).toHaveURL(/homeworkView=list/);
    await expect(page.getByTestId("dashboard-homeworks-list")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("life-ustc-dashboard-view-mode"),
        ),
      )
      .toBe("list");

    await gotoAndWaitForReady(page, "/dashboard/homeworks");
    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/dashboard\/homeworks$/);
    await expect(page.getByTestId("dashboard-homeworks-list")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "homeworks/list-view");
  });

  test("可切换作业完成状态", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    // Switch to "all" filter
    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    await expect(page.getByRole("switch")).toHaveCount(0);

    const card = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(card).toBeVisible();
    await card.hover();

    const completionButton = card
      .getByRole("button", {
        name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
      })
      .first();
    await expect(completionButton).toHaveCSS("opacity", "1");

    const before = (await completionButton.textContent())?.trim() ?? "";

    const completionResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/homeworks/") &&
        r.url().includes("/completion") &&
        r.status() === 200,
    );
    await completionButton.click();
    await completionResponse;
    await expect(completionButton).not.toHaveText(before, { timeout: 15_000 });

    const after = (await completionButton.textContent())?.trim() ?? "";
    expect(after).not.toBe(before);
    await captureStepScreenshot(page, testInfo, "homeworks/completion-toggled");

    // Restore
    const restoreResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/homeworks/") &&
        r.url().includes("/completion") &&
        r.status() === 200,
    );
    await completionButton.click();
    await restoreResponse;
  });

  test("完成状态更新失败显示本地化仪表盘错误", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await page.route(/\/api\/homeworks\/[^/]+\/completion$/, async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: { message: "forced failure" } }),
        contentType: "application/json",
        status: 500,
      });
    });
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const card = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(card).toBeVisible();
    await card.hover();

    const completionButton = card
      .getByRole("button", {
        name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
      })
      .first();
    await expect(completionButton).toHaveCSS("opacity", "1");

    const completionResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/homeworks/") &&
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
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const detailLink = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await detailLink
      .getByRole("button", { name: new RegExp(DEV_SEED.homeworks.title) })
      .first()
      .click();
    const popout = page.locator('[data-slot="dialog-content"]').first();
    await expect(popout).toBeVisible();
    const sectionLink = popout
      .locator(
        `a[href*="/sections/${DEV_SEED.section.jwId}/homework#homework-"]`,
      )
      .first();
    await expect(sectionLink).toBeVisible();
    await sectionLink.click();

    await expect(page).toHaveURL(/\/sections\/\d+\/homework#homework-/);
    await captureStepScreenshot(page, testInfo, "homeworks/view-details");
  });

  test("可以创建新作业", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
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
    await page.getByTestId("dashboard-homework-create").click();

    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });
    await captureStepScreenshot(page, testInfo, "homeworks/created");
  });

  test("新建作业展示可折叠的英文填写规范", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    const localeResponse = await page.request.post("/api/locale", {
      data: { locale: "en-us" },
    });
    expect(localeResponse.status()).toBe(200);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
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
    await signInAsDebugUser(page, "/dashboard/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/homeworks", {
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
      const card = page
        .locator('[data-slot="card"]')
        .filter({ hasText: title })
        .first();
      await expect(card).toBeVisible({ timeout: 15_000 });

      await page.keyboard.press("Escape");
      await expect(
        page.locator('[data-slot="dialog-content"]').first(),
      ).toHaveCount(0, { timeout: 5_000 });

      await expect(card.getByText(/Major assignment|大作业/i)).toBeVisible();
      await expect(card.getByText(/Team required|需要组队/i)).toBeVisible();

      const dueText = card
        .locator("p")
        .filter({ hasText: /Due:|截止/ })
        .first();
      await expect(dueText).toContainText(
        /2026-12-31|2026\/12\/31|12月31日|Dec 31/,
      );
      await expect(dueText).toContainText(/23:59|11:59 PM/);

      await card.getByRole("button", { name: new RegExp(title) }).click();
      const detailDialog = page.locator('[data-slot="dialog-content"]').first();
      await expect(detailDialog).toBeVisible();
      await expect(detailDialog.getByText(description)).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "homeworks/created-full-fields",
      );

      const cardId = await card.getAttribute("id");
      homeworkId = cardId?.replace("homework-", "");
    } finally {
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });
});
