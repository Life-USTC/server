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

test.describe("dashboard todos", () => {
  test("unauthenticated ?tab=todos falls back to public view", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=todos", {
      testInfo,
      screenshotLabel: "todos",
    });

    await expect(page).toHaveURL(/\/\?tab=todos$/);
    await expect(page.locator("#main-content")).toBeVisible();

    await expect(
      page.getByRole("tab", { name: /^(网站|Websites)$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "dashboard-todos-unauthorized");
  });

  test("authenticated shows seed todos", async ({ page }, testInfo) => {
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

  test("completed filter shows completed todo", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/todos");

    const completedFilter = page
      .getByRole("tab", { name: /已完成|Completed/i })
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

  test("can create and delete a todo", async ({ page }, testInfo) => {
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
