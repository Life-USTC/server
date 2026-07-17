/**
 * E2E tests for the todos dashboard (`/dashboard/todos`)
 *
 * ## Data Represented
 * - Seed todos: DEV_SEED.todos.dueTodayTitle (due today, incomplete) and
 *   DEV_SEED.todos.completedTitle (completed)
 * - Each todo card shows: title, priority badge, due date, hover completion button,
 *   and optional markdown content
 *
 * ## UI/UX Elements
 * - Filter toolbar: incomplete (default) / completed / all
 * - Completion button is available from each todo card
 * - Add button opens a modal form (title, priority, due date, content)
 * - Clicking a todo title opens a detail modal with a delete button
 * - Todo cards display priority badges (high/medium/low)
 *
 * ## Edge Cases
 * - Unauthenticated users see the public dashboard view (todos tab is auth-only)
 * - Optimistic updates via useOptimistic for toggle/delete/add
 * - Empty state shown when filter yields no matching todos
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe("仪表盘待办", () => {
  test("未登录 ?tab=todos 回退到公共视图", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=todos", {
      testInfo,
      screenshotLabel: "todos",
    });

    await expect(page).toHaveURL(/\/\?tab=todos$/);
    await expect(page.locator("#main-content")).toBeVisible();

    await expect(
      page.getByRole("link", { name: /^(网站|Websites)$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "dashboard-todos-unauthorized");
  });

  test("登录后显示种子待办", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/todos");

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(
      page.getByText(DEV_SEED.todos.dueTodayTitle).first(),
    ).toBeVisible();
    await expect(
      page.getByText(DEV_SEED.todos.overdueTitle).first(),
    ).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(0);

    const card = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.todos.dueTodayTitle })
      .first();
    await expect(card).toBeVisible();
    const completionButton = card
      .getByRole("button", { name: /标记为完成|Mark as complete/i })
      .first();
    await card.hover();
    await expect(completionButton).toBeVisible();
    await expect(completionButton).toBeEnabled();

    await captureStepScreenshot(page, testInfo, "dashboard-todos-seed");
  });

  test("移动端待办工具栏保留筛选和大尺寸主操作", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.removeItem("life-ustc-dashboard-view-mode");
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await signInAsDebugUser(page, "/dashboard/todos");

    const incomplete = page
      .getByRole("radio", { name: /未完成|Incomplete/i })
      .first();
    const add = page.getByTestId("dashboard-todos-add");
    const viewMenu = page.getByTestId("dashboard-todos-view-menu");
    await expect(incomplete).toBeVisible();
    await expect(add).toBeVisible();
    await expect(viewMenu).toBeVisible();

    for (const control of [incomplete, add, viewMenu]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }

    const all = page.getByRole("radio", { name: /全部|All/i }).first();
    await all.click();
    await expect(all).toHaveAttribute("aria-checked", "true");

    await viewMenu.click();
    await page.getByRole("menuitemradio", { name: /列表|List/i }).click();
    await expect(page).toHaveURL(/todoView=list/);
    await expect(page.getByRole("table")).toBeVisible();
    await expect(all).toHaveAttribute("aria-checked", "true");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await captureStepScreenshot(page, testInfo, "todos/mobile-toolbar");
  });

  test("可切换待办完成状态并更新筛选", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/todos");

    const card = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.todos.dueTodayTitle })
      .first();
    await expect(card).toBeVisible();

    const completeButton = card
      .getByRole("button", { name: /标记为完成|Mark as complete/i })
      .first();
    await card.hover();
    await expect(completeButton).toBeVisible();
    await completeButton.click();

    // Optimistic update removes it from the default incomplete filter
    await expect(
      page.getByText(DEV_SEED.todos.dueTodayTitle).first(),
    ).toHaveCount(0, { timeout: 5_000 });

    // It now appears under the completed filter
    const completedFilter = page
      .getByRole("radio", { name: /已完成|Completed/i })
      .first();
    await completedFilter.click();
    await expect(
      page.getByText(DEV_SEED.todos.dueTodayTitle).first(),
    ).toBeVisible({ timeout: 5_000 });

    // Toggle back to restore seed state
    const completedCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: DEV_SEED.todos.dueTodayTitle })
      .first();
    const incompleteButton = completedCard
      .getByRole("button", { name: /取消完成|Mark as incomplete/i })
      .first();
    await completedCard.hover();
    await incompleteButton.click();

    await expect(
      page.getByText(DEV_SEED.todos.dueTodayTitle).first(),
    ).toHaveCount(0, { timeout: 5_000 });

    await captureStepScreenshot(page, testInfo, "dashboard-todos-toggle");
  });

  test("已完成筛选显示已完成的待办", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/todos");

    const completedFilter = page
      .getByRole("radio", { name: /已完成|Completed/i })
      .first();
    const completedTodo = page.getByText(DEV_SEED.todos.completedTitle).first();
    await expect(async () => {
      await completedFilter.click();
      await expect(completedTodo).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 15_000,
      intervals: [250, 500, 1_000],
    });

    await captureStepScreenshot(page, testInfo, "dashboard-todos-completed");
  });

  test("嵌套待办路由渲染服务端操作错误", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/todos");

    const postResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/dashboard/todos?/createTodo"),
    );
    await page.evaluate(() => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/dashboard/todos?/createTodo";
      document.body.append(form);
      form.requestSubmit();
    });

    await expect((await postResponse).status()).toBe(400);
    await expect(
      page.getByText(/请输入标题|Please enter a title/i).first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "dashboard-todos-action-error");
  });

  test("可以创建和删除待办", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/dashboard/todos");

    const title = `e2e-dashboard-todo-${Date.now()}`;

    // Create a new todo via modal form
    const addTodoButton = page
      .getByRole("button", { name: /添加待办|Add Todo/i })
      .first();
    await expect(addTodoButton).toBeVisible();
    await expect(addTodoButton).toBeEnabled();
    const titleInput = page.getByLabel(/标题|Title/i);
    await expect(async () => {
      await addTodoButton.click();
      await expect(titleInput).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });
    await titleInput.fill(title);
    await page
      .getByRole("button", { name: /创建待办|Create Todo/i })
      .first()
      .click();

    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });
    await captureStepScreenshot(page, testInfo, "dashboard-todos-created");

    // Delete the todo via detail modal
    await page.getByText(title).first().click();
    await page
      .getByRole("button", { name: /删除待办|Delete todo/i })
      .first()
      .click();

    await expect(page.getByText(title)).toHaveCount(0, { timeout: 15_000 });
    await captureStepScreenshot(page, testInfo, "dashboard-todos-deleted");
  });
});
